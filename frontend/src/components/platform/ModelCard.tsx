"use client";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Download, ShieldCheck } from "lucide-react";
import { api, downloadText } from "@/lib/api";
import { defaults } from "@/lib/contracts";
import { options } from "./ScenarioForm";
import {
  Failure,
  labels,
  Limitation,
  Loading,
  PageTitle,
  Panel,
  Status,
  useHealth,
  useMetadata,
} from "./ui";

const metricsSchema = z
  .object({
    model_version: z.string(),
    dataset_sha256: z.string(),
    evaluation_set: z.string(),
    accuracy: z.number(),
    macro_f1: z.number(),
    weighted_f1: z.number(),
    class_labels: z.array(z.string()),
    confusion_matrix: z.array(z.array(z.number())),
    classification_report: z.record(z.string(), z.unknown()),
    comparison: z.array(
      z.object({ candidate: z.string(), validation_macro_f1: z.number() }),
    ),
    selected_model: z.string(),
    split: z.string(),
  })
  .passthrough();
export default function ModelCard() {
  const metadata = useMetadata(),
    health = useHealth();
  const metrics = useQuery({
    queryKey: ["model-metrics"],
    queryFn: () => api("metrics", metricsSchema),
    retry: false,
  });
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="RESOURCES / MODEL CARD"
        title="Trust starts with what we can verify."
        description="Serving behavior, provenance, evaluation status, and limitations in one place."
      >
        <button
          className="button"
          disabled={!metadata.data}
          onClick={() =>
            downloadText(
              "roadsentinel-model-card.json",
              JSON.stringify(
                {
                  metadata: metadata.data,
                  health: health.data,
                  metrics: metrics.data ?? null,
                  evaluation_available: Boolean(metrics.data),
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          <Download size={15} />
          Export model card
        </button>
      </PageTitle>
      {metadata.isPending ? (
        <Loading />
      ) : metadata.error ? (
        <Failure error={metadata.error} retry={() => void metadata.refetch()} />
      ) : (
        metadata.data && (
          <>
            <div className="two-columns">
              <Panel
                title="Serving model"
                subtitle="Original artifact, preserved and fingerprinted"
                action={
                  <ShieldCheck size={20} style={{ color: "var(--accent)" }} />
                }
              >
                <div className="doc-content">
                  <h3>{metadata.data.algorithm}</h3>
                  <p>
                    Version: <code>{metadata.data.model_version}</code>
                  </p>
                  <p>{metadata.data.provenance}</p>
                  <p>
                    Inference calls the estimator&apos;s probability interface.
                    Model confidence is the probability of its selected class.
                    Local explanations use actual Tree SHAP.
                  </p>
                </div>
                <div className="readiness-row">
                  <span>Model availability</span>
                  <Status tone={health.data?.model_available ? "good" : "warn"}>
                    {health.data?.model_available ? "Loaded" : "Unavailable"}
                  </Status>
                </div>
                <div className="readiness-row">
                  <span>Class semantics</span>
                  <Status
                    tone={metadata.data.semantics_verified ? "good" : "warn"}
                  >
                    {metadata.data.semantics_verified
                      ? "Verified"
                      : "Unverified"}
                  </Status>
                </div>
                <div className="readiness-row">
                  <span>Canonical speed units</span>
                  <strong>{metadata.data.speed_unit}</strong>
                </div>
                <div className="readiness-row">
                  <span>Probability calibration</span>
                  <strong>
                    {metadata.data.calibrated ? "Calibrated" : "Uncalibrated"}
                  </strong>
                </div>
              </Panel>
              <Panel
                title="Training data & evaluation"
                subtitle="Dataset statistics are not application activity"
              >
                {metrics.isPending ? (
                  <Loading />
                ) : metrics.error ? (
                  <>
                    <Limitation>{metrics.error.message}</Limitation>
                    <div className="doc-content">
                      <h3>Not currently verifiable</h3>
                      <ul>
                        <li>
                          Training dataset source, license, geography, dates,
                          and class balance.
                        </li>
                        <li>
                          Original split strategy, preprocessing,
                          duplicate/leakage checks, and fitting procedure.
                        </li>
                        <li>
                          Accuracy, macro F1, precision/recall, confusion
                          matrix, and model comparison.
                        </li>
                      </ul>
                      <p>
                        A reproducible training/evaluation script is included in
                        the repository for a future reviewed dataset. No
                        experiment results have been invented.
                      </p>
                    </div>
                  </>
                ) : (
                  metrics.data && (
                    <>
                      <table>
                        <tbody>
                          <tr>
                            <td>Accuracy</td>
                            <td>{(metrics.data.accuracy * 100).toFixed(2)}%</td>
                          </tr>
                          <tr>
                            <td>Macro F1</td>
                            <td>{metrics.data.macro_f1.toFixed(4)}</td>
                          </tr>
                          <tr>
                            <td>Weighted F1</td>
                            <td>{metrics.data.weighted_f1.toFixed(4)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="chart-annotation">
                        {metrics.data.evaluation_set} · {metrics.data.split} ·{" "}
                        {metrics.data.dataset_sha256}
                      </p>
                      <details className="details-panel">
                        <summary>
                          Confusion matrix, per-class metrics & model comparison
                        </summary>
                        <pre className="code-block">
                          {JSON.stringify(
                            {
                              labels: metrics.data.class_labels,
                              confusion_matrix: metrics.data.confusion_matrix,
                              classification_report:
                                metrics.data.classification_report,
                              comparison: metrics.data.comparison,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </>
                  )
                )}
              </Panel>
            </div>
            <Panel
              title="Feature contract"
              subtitle="Order verified from the persisted artifact; category meanings remain provisional"
            >
              <div className="table-scroll">
                <table className="feature-table">
                  <thead>
                    <tr>
                      <th>Order / feature</th>
                      <th>Meaning in original UI</th>
                      <th>Operational limits / source codes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metadata.data.feature_order.map((feature, i) => (
                      <tr key={feature}>
                        <td className="mono">
                          {i + 1}. {feature}
                        </td>
                        <td>{labels[feature]}</td>
                        <td>
                          {options[feature]
                            ? options[feature]
                                .map(([code, label]) => `${code}: ${label}`)
                                .join("; ")
                            : feature === "Age_of_Driver"
                              ? "16-100 years"
                              : feature === "Speed_limit"
                                ? "10-140 native units; posted limit, not actual speed"
                                : "1-20 vehicles"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="chart-annotation">
                These validation bounds are operational safeguards, not
                recovered training support. Defaults contain only the seven
                original feature identities: {Object.keys(defaults).length}{" "}
                fields.
              </p>
            </Panel>
            <div className="two-columns">
              <Panel title="Classes, confidence & index">
                <div className="doc-content">
                  <p>
                    Current outputs:{" "}
                    {metadata.data.classes
                      .map((c) => `${c.id} → ${c.label}`)
                      .join(", ")}
                    .
                  </p>
                  <p>
                    The former source mapped 1/2/3 to Slight/Serious/Fatal, but
                    no codebook establishes that this mapping is correct.
                    Numeric class IDs alone cannot confirm severity meanings.
                  </p>
                  <p>
                    The proposed index is{" "}
                    <code>100 × (0 × Slight + 0.5 × Serious + 1 × Fatal)</code>.
                    It remains withheld until class meanings are verified. This
                    is a documented product index, not the probability of an
                    accident.
                  </p>
                </div>
              </Panel>
              <Panel title="Intended use & limitations">
                <div className="doc-content">
                  <ul>
                    {metadata.data.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    Intended use: research, software demonstration, and
                    inspecting this model&apos;s behavior. Out of scope:
                    emergency response, individual safety decisions, insurance,
                    enforcement, or claims that a road or driver is safe.
                    Driver-age correlations can reflect sampling and social
                    biases; SHAP does not establish causality.
                  </p>
                </div>
              </Panel>
            </div>
          </>
        )
      )}
    </div>
  );
}
