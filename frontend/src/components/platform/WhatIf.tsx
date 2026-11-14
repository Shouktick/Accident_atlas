"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { api, downloadText } from "@/lib/api";
import { defaults, predictionSchema, scenarioSchema } from "@/lib/contracts";
import { ControlledScenario } from "./ScenarioForm";
import { Failure, labels, Limitation, PageTitle, Panel } from "./ui";

const comparisonSchema = z.object({
  baseline: predictionSchema,
  scenarios: z.array(
    predictionSchema.extend({
      risk_delta: z.number().nullable(),
      feature_differences: z.array(z.string()),
    }),
  ),
  best_change: predictionSchema.nullable(),
  best_change_status: z.string(),
  limitation: z.string(),
});
const sweepSchema = z.object({
  speed_unit: z.string(),
  points: z.array(
    z.object({ speed: z.number(), prediction: predictionSchema }),
  ),
});

export default function WhatIf() {
  const [a, setA] = useState(defaults),
    [b, setB] = useState({
      ...defaults,
      Speed_limit: 70,
      Weather_Conditions: 2,
    } as typeof defaults);
  const [sweepStart, setSweepStart] = useState(20),
    [sweepStop, setSweepStop] = useState(100);
  const comparison = useMutation({
    mutationFn: () =>
      api("predict/whatif", comparisonSchema, {
        method: "POST",
        body: JSON.stringify({
          baseline: a,
          scenarios: [b],
          find_best_change: true,
        }),
      }),
  });
  const sweep = useMutation({
    mutationFn: () =>
      api("predict/speed-sweep", sweepSchema, {
        method: "POST",
        body: JSON.stringify({
          scenario: a,
          start: sweepStart,
          stop: sweepStop,
          step: 10,
        }),
      }),
  });
  const valid =
    scenarioSchema.safeParse(a).success && scenarioSchema.safeParse(b).success;
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="WORKSPACE / WHAT-IF"
        title="Change the inputs. Compare the model."
        description="A controlled model comparison, not evidence that a change causes a real-world outcome."
      />
      <div className="two-columns">
        <Panel
          title="Scenario A"
          subtitle="Baseline · also used for the speed-limit sweep"
        >
          <ControlledScenario
            value={a}
            onChange={(value) => {
              setA(value);
              comparison.reset();
              sweep.reset();
            }}
            id="scenario-a"
          />
        </Panel>
        <Panel
          title="Scenario B"
          subtitle="Alternative · change one or several inputs"
        >
          <ControlledScenario
            value={b}
            onChange={(value) => {
              setB(value);
              comparison.reset();
            }}
            id="scenario-b"
          />
        </Panel>
      </div>
      <div className="actions">
        <button
          className="button primary"
          disabled={!valid || comparison.isPending}
          onClick={() => comparison.mutate()}
        >
          {comparison.isPending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowLeftRight size={16} />
          )}{" "}
          Compare actual model responses
        </button>
      </div>
      {comparison.error && (
        <Failure error={comparison.error} retry={() => comparison.mutate()} />
      )}
      {comparison.data && (
        <Panel
          title="Comparison results"
          subtitle="Probability changes in percentage points"
          action={
            <button
              className="button small"
              onClick={() =>
                downloadText(
                  "roadsentinel-comparison.json",
                  JSON.stringify(comparison.data, null, 2),
                  "application/json",
                )
              }
            >
              Export comparison
            </button>
          }
        >
          <div className="split-summary">
            <div>
              <small>BASELINE OUTPUT</small>
              <strong>{comparison.data.baseline.severity}</strong>
            </div>
            <div>
              <small>ALTERNATIVE OUTPUT</small>
              <strong>{comparison.data.scenarios[0].severity}</strong>
            </div>
            <div>
              <small>SEVERITY INDEX DIFFERENCE</small>
              <strong>
                {comparison.data.scenarios[0].risk_delta === null
                  ? "Withheld"
                  : `${comparison.data.scenarios[0].risk_delta! > 0 ? "+" : ""}${comparison.data.scenarios[0].risk_delta}`}
              </strong>
            </div>
          </div>
          <div className="comparison-charts">
            {comparison.data.baseline.probabilities.map((p, i) => {
              const q = comparison.data!.scenarios[0].probabilities[i];
              return (
                <div key={p.class_id}>
                  <div className="bar-label">
                    <span>{p.label}</span>
                    <strong>
                      {((q.probability - p.probability) * 100).toFixed(2)} pp
                    </strong>
                  </div>
                  <div className="compare-bars">
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${p.probability * 100}%` }}
                      />
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill class-1"
                        style={{ width: `${q.probability * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span>Scenario A</span>
            <span>Scenario B</span>
          </div>
          <p className="chart-annotation">
            Changed features:{" "}
            {comparison.data.scenarios[0].feature_differences
              .map((f) => labels[f])
              .join(", ") || "None"}
            .
          </p>
          <div style={{ marginTop: 20 }}>
            <Limitation>
              {comparison.data.best_change_status ===
              "requires_verified_severity_labels"
                ? "The single-change risk reduction search is withheld until class severity meanings are verified. Probability changes above are still genuine model outputs."
                : comparison.data.best_change
                  ? `Lowest evaluated single-change index: ${comparison.data.best_change.risk_score}. This is a hypothetical association, not a recommendation or safety guarantee.`
                  : "No evaluated single-feature alternative reduced the model index."}
            </Limitation>
          </div>
        </Panel>
      )}
      <Panel
        title="Speed-limit sweep"
        subtitle="Evaluates Scenario A across native model values"
      >
        <div className="filters">
          <div className="field">
            <label htmlFor="sweep-start">Start · native model units</label>
            <input
              id="sweep-start"
              type="number"
              min="10"
              max="140"
              value={sweepStart}
              onChange={(e) => {
                setSweepStart(Number(e.target.value));
                sweep.reset();
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="sweep-stop">Stop · native model units</label>
            <input
              id="sweep-stop"
              type="number"
              min="10"
              max="140"
              value={sweepStop}
              onChange={(e) => {
                setSweepStop(Number(e.target.value));
                sweep.reset();
              }}
            />
          </div>
          <button
            className="button"
            disabled={
              !valid ||
              sweep.isPending ||
              sweepStart > sweepStop ||
              sweepStart < 10 ||
              sweepStop > 140
            }
            onClick={() => sweep.mutate()}
          >
            {sweep.isPending && <LoaderCircle size={15} className="spin" />}Run
            sweep
          </button>
        </div>
        {sweep.error && (
          <Failure error={sweep.error} retry={() => sweep.mutate()} />
        )}
        {sweep.data && (
          <>
            <svg
              className="line-chart"
              viewBox="0 0 720 300"
              role="img"
              aria-label="Model class probability by native speed-limit input"
            >
              <line x1="60" y1="240" x2="690" y2="240" stroke="var(--stroke)" />
              <line x1="60" y1="30" x2="60" y2="240" stroke="var(--stroke)" />
              {[0, 25, 50, 75, 100].map((p) => (
                <g key={p}>
                  <line
                    x1="60"
                    y1={240 - p * 2}
                    x2="690"
                    y2={240 - p * 2}
                    stroke="var(--stroke)"
                    strokeDasharray="3 5"
                  />
                  <text x="45" y={244 - p * 2} textAnchor="end" fontSize="10">
                    {p}%
                  </text>
                </g>
              ))}
              {sweep.data.points[0].prediction.probabilities.map((p, index) => (
                <polyline
                  key={p.class_id}
                  points={sweep
                    .data!.points.map(
                      (point, i) =>
                        `${60 + (i / Math.max(1, sweep.data!.points.length - 1)) * 630},${240 - point.prediction.probabilities[index].probability * 200}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={
                    ["var(--accent)", "var(--blue)", "var(--teal)"][index]
                  }
                  strokeWidth="2.5"
                />
              ))}
              {sweep.data.points.map((point, i) => (
                <text
                  key={point.speed}
                  x={
                    60 + (i / Math.max(1, sweep.data!.points.length - 1)) * 630
                  }
                  y="260"
                  textAnchor="middle"
                  fontSize="10"
                >
                  {point.speed}
                </text>
              ))}
              <text x="375" y="287" textAnchor="middle" fontSize="11">
                Posted speed-limit input · native model units (unverified)
              </text>
              <text
                x="18"
                y="135"
                textAnchor="middle"
                transform="rotate(-90 18 135)"
                fontSize="10"
              >
                Class probability (%)
              </text>
            </svg>
            <div className="chart-legend">
              {sweep.data.points[0].prediction.probabilities.map((p, i) => (
                <span
                  key={p.class_id}
                  style={{
                    color: ["var(--accent)", "var(--blue)", "var(--teal)"][i],
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
            <p className="chart-annotation">
              Source: actual model responses to the baseline scenario. Curves
              need not be monotonic. Speed limit is not measured driving speed.
            </p>
            <details className="details-panel">
              <summary>View sweep values</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Native value</th>
                      <th>Model output</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweep.data.points.map((p) => (
                      <tr key={p.speed}>
                        <td>{p.speed}</td>
                        <td>{p.prediction.severity}</td>
                        <td>{(p.prediction.confidence * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Panel>
    </div>
  );
}
