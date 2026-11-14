"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import { defaults, predictionSchema, Scenario } from "@/lib/contracts";
import ScenarioForm from "./ScenarioForm";
import { Contributions, ProbabilityBars } from "./PredictionResult";
import { Failure, labels, Limitation, Loading, PageTitle, Panel } from "./ui";

const globalSchema = z.object({
  sample_size: z.number(),
  method: z.string(),
  provenance: z.object({ source: z.string(), sha256: z.string() }),
  items: z.array(z.object({ feature: z.string(), importance: z.number() })),
  dependence: z.array(
    z.object({
      feature: z.string(),
      class_id: z.string(),
      points: z.array(
        z.object({ value: z.number(), contribution: z.number() }),
      ),
    }),
  ),
});
export default function ExplainLab() {
  const [simple, setSimple] = useState(true),
    [selected, setSelected] = useState(""),
    [feature, setFeature] = useState(Object.keys(defaults)[0]);
  const history = useQuery({
    queryKey: ["history", "explain"],
    queryFn: () =>
      api(
        "predictions?limit=100",
        z.object({ items: z.array(predictionSchema) }),
      ),
  });
  const global = useQuery({
    queryKey: ["global-shap"],
    queryFn: () => api("explain/global", globalSchema),
    retry: false,
  });
  const local = useMutation({
    mutationFn: (scenario: Scenario) =>
      api("explain/local", predictionSchema, {
        method: "POST",
        body: JSON.stringify(scenario),
      }),
  });
  const dependence = global.data?.dependence.find(
    (row) => row.feature === feature && row.class_id === local.data?.class_id,
  );
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="INTELLIGENCE / EXPLAINABLE AI"
        title="Look inside the model's response."
        description="Genuine Tree SHAP contributions tied to a specific scenario, class, and model version."
      >
        <label className="check-label">
          <input
            type="checkbox"
            checked={simple}
            onChange={(e) => setSimple(e.target.checked)}
          />
          Explain like I&apos;m new to ML
        </label>
      </PageTitle>
      <div className="prediction-grid">
        <Panel
          title="Explain a scenario"
          subtitle="No prediction or history is fabricated"
        >
          <div className="field" style={{ marginBottom: 24 }}>
            <label htmlFor="explain-saved">Use a saved scenario</label>
            <select
              id="explain-saved"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">
                Select from this session&apos;s saved predictions
              </option>
              {history.data?.items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.id.slice(0, 8)} · {row.severity}
                </option>
              ))}
            </select>
            {selected && (
              <button
                className="button small"
                style={{ marginTop: 10 }}
                onClick={() => {
                  const record = history.data?.items.find(
                    (row) => row.id === selected,
                  );
                  if (record) local.mutate(record.scenario);
                }}
                disabled={local.isPending}
              >
                Explain selected record
              </button>
            )}
          </div>
          <ScenarioForm
            pending={local.isPending}
            allowSave={false}
            submitLabel="Compute local Tree SHAP"
            onSubmit={(scenario) => local.mutate(scenario)}
          />
        </Panel>
        <Panel
          title="Local contribution waterfall"
          subtitle={
            simple
              ? "What moved this class probability up or down?"
              : "Signed additive attribution in model probability space"
          }
        >
          {local.isPending ? (
            <Loading message="Computing Tree SHAP for this actual scenario…" />
          ) : local.error ? (
            <Failure
              error={local.error}
              retry={() => local.variables && local.mutate(local.variables)}
            />
          ) : local.data ? (
            <>
              <div className="signal-banner">
                <div>
                  <small className="eyebrow">EXPLAINED MODEL OUTPUT</small>
                  <strong>{local.data.severity}</strong>
                </div>
                <strong>{(local.data.confidence * 100).toFixed(1)}%</strong>
              </div>
              <Contributions prediction={local.data} simple={simple} />
              <details className="details-panel" open={!simple}>
                <summary>Inspect additive waterfall values</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Contribution (pp)</th>
                        <th>Running probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Expected value</td>
                        <td>—</td>
                        <td>
                          {(
                            (local.data.explanation?.base_value ?? 0) * 100
                          ).toFixed(2)}
                          %
                        </td>
                      </tr>
                      {local.data.explanation?.contributions.map(
                        (row, i, all) => (
                          <tr key={row.feature}>
                            <td>
                              {labels[row.feature]} = {row.value}
                            </td>
                            <td>
                              {row.contribution >= 0 ? "+" : ""}
                              {(row.contribution * 100).toFixed(2)}
                            </td>
                            <td>
                              {(
                                ((local.data!.explanation?.base_value ?? 0) +
                                  all
                                    .slice(0, i + 1)
                                    .reduce((n, c) => n + c.contribution, 0)) *
                                100
                              ).toFixed(2)}
                              %
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
              <ProbabilityBars prediction={local.data} />
              <Limitation>
                {simple
                  ? "A contribution explains this model's behavior. It does not prove that the input causes a crash or injury."
                  : local.data.explanation?.method}
              </Limitation>
            </>
          ) : (
            <Limitation>
              Run a custom scenario or select a saved record. Local explanations
              use the fitted trees&apos; path counts as background; they do not
              require fabricated accident samples.
            </Limitation>
          )}
        </Panel>
      </div>
      <Panel
        title="Global SHAP & feature dependence"
        subtitle="Requires representative, verified source records"
      >
        {global.isPending ? (
          <Loading />
        ) : global.error ? (
          <Limitation>
            {global.error.message} Local Tree SHAP above remains available when
            the inference service is ready.
          </Limitation>
        ) : (
          global.data && (
            <>
              <p className="chart-annotation">
                {global.data.method} · {global.data.sample_size} sampled records
                · Source: {global.data.provenance.source}
              </p>
              <div className="distribution">
                {[...global.data.items]
                  .sort((a, b) => b.importance - a.importance)
                  .map((row) => (
                    <div key={row.feature}>
                      <div className="bar-label">
                        <span>{labels[row.feature]}</span>
                        <strong>{row.importance.toFixed(4)}</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(row.importance / Math.max(...global.data!.items.map((i) => i.importance), 0.001)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="field">
                <label htmlFor="dependence-feature">Dependence feature</label>
                <select
                  id="dependence-feature"
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                >
                  {Object.keys(defaults).map((f) => (
                    <option key={f} value={f}>
                      {labels[f]}
                    </option>
                  ))}
                </select>
              </div>
              {dependence ? (
                <div className="table-scroll">
                  <table>
                    <caption>
                      Feature dependence for class {dependence.class_id} ·
                      sampled source records
                    </caption>
                    <thead>
                      <tr>
                        <th>Feature value (native units)</th>
                        <th>SHAP contribution (probability)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependence.points.map((p, i) => (
                        <tr key={i}>
                          <td>{p.value}</td>
                          <td>{p.contribution.toFixed(5)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="chart-annotation">
                  Compute a local explanation to select the explained class for
                  dependence values.
                </p>
              )}
            </>
          )
        )}
      </Panel>
    </div>
  );
}
