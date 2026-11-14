"use client";
import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { Prediction, shareScenario } from "@/lib/contracts";
import { downloadText } from "@/lib/api";
import { labels, Limitation, Panel, Status } from "./ui";

export function ProbabilityBars({ prediction }: { prediction: Prediction }) {
  return (
    <div
      className="distribution"
      aria-label="Model class probability distribution"
    >
      {prediction.probabilities.map((p, i) => (
        <div key={p.class_id}>
          <div className="bar-label">
            <span>{p.label}</span>
            <strong>{(p.probability * 100).toFixed(1)}%</strong>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill class-${i}`}
              style={{ width: `${p.probability * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Contributions({
  prediction,
  simple = true,
  limit = 7,
}: {
  prediction: Prediction;
  simple?: boolean;
  limit?: number;
}) {
  const explanation = prediction.explanation;
  if (!explanation)
    return (
      <Limitation>
        Local SHAP was {prediction.explanation_status.replaceAll("_", " ")}. No
        feature contributions have been substituted.
      </Limitation>
    );
  const contributions = [...explanation.contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
  const max = Math.max(
    ...contributions.map((c) => Math.abs(c.contribution)),
    0.001,
  );
  return (
    <div>
      <div className="contribution-list">
        {contributions.map((row) => (
          <div className="contribution-row" key={row.feature}>
            <span>{labels[row.feature] || row.feature}</span>
            <div className="contribution-track">
              <div className="contribution-half">
                {row.contribution < 0 && (
                  <div
                    className="contribution-bar negative"
                    style={{
                      width: `${(Math.abs(row.contribution) / max) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="contribution-half">
                {row.contribution >= 0 && (
                  <div
                    className="contribution-bar"
                    style={{ width: `${(row.contribution / max) * 100}%` }}
                  />
                )}
              </div>
            </div>
            <span className="mono">
              {row.contribution >= 0 ? "+" : ""}
              {(row.contribution * 100).toFixed(2)} pp
            </span>
          </div>
        ))}
      </div>
      <div className="contribution-legend">
        <span>Raises class probability</span>
        <span>Lowers class probability</span>
      </div>
      <p className="chart-annotation">
        {simple
          ? `These inputs move the model toward or away from ${prediction.severity}. They do not establish causes of a real-world outcome.`
          : `Tree SHAP for class ${explanation.class_id} in probability space. Base ${(explanation.base_value * 100).toFixed(2)}% + all seven signed contributions = ${(explanation.output_value * 100).toFixed(2)}%. Background: fitted tree-path counts.`}
      </p>
    </div>
  );
}
export function RiskMeter({ value }: { value: number | null }) {
  return value === null ? (
    <div className="risk-meter">
      <div className="risk-label">
        <span>Severity-weighted index</span>
        <strong>Withheld</strong>
      </div>
      <p className="chart-annotation">
        Verified class-to-severity meanings are required. Class confidence is
        not an accident-risk percentage.
      </p>
    </div>
  ) : (
    <div className="risk-meter">
      <div className="risk-label">
        <span>Severity-weighted index</span>
        <strong>{value.toFixed(1)} / 100</strong>
      </div>
      <div className="risk-scale">
        <span className="risk-marker" style={{ left: `${value}%` }} />
      </div>
      <p className="chart-annotation">
        100 × (0 × Slight + 0.5 × Serious + 1 × Fatal). This index is not crash
        probability.
      </p>
    </div>
  );
}
export default function PredictionResult({
  prediction,
}: {
  prediction: Prediction;
}) {
  const [feedback, setFeedback] = useState("");
  const summary = `RoadSentinel ${prediction.id}\nModel: ${prediction.model_version}\nOutput: ${prediction.severity}\nModel confidence: ${(prediction.confidence * 100).toFixed(1)}% (uncalibrated: ${!prediction.calibrated})\nSeverity meanings verified: ${prediction.semantics_verified}\n${JSON.stringify(prediction.scenario, null, 2)}\nModel output is not a safety guarantee or crash probability.`;
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(message);
    } catch {
      setFeedback("Clipboard permission unavailable. Use Export JSON instead.");
    }
  }
  return (
    <Panel
      title="Model response"
      subtitle={`${prediction.model_version} · ${prediction.latency_ms.toFixed(1)} ms measured`}
      className="result-panel"
      action={<Status tone="good">ACTUAL INFERENCE</Status>}
    >
      <div className="result-verdict">
        <div>
          <span className="eyebrow">
            {prediction.semantics_verified
              ? "PREDICTED SEVERITY"
              : "PREDICTED NUMERIC CLASS"}
          </span>
          <strong>{prediction.severity}</strong>
          <small>
            {prediction.semantics_verified
              ? "Verified class mapping"
              : "Severity meaning unverified"}
          </small>
        </div>
        <div className="result-confidence">
          <strong>{(prediction.confidence * 100).toFixed(1)}%</strong>
          <small>model confidence</small>
        </div>
      </div>
      <ProbabilityBars prediction={prediction} />
      <RiskMeter value={prediction.risk_score} />
      <h3>Top SHAP contributors</h3>
      <Contributions prediction={prediction} limit={3} />
      <Limitation>
        Probabilities are{" "}
        {prediction.calibrated
          ? "calibrated according to model metadata"
          : "uncalibrated model estimates"}
        , conditional on the model&apos;s incident data. They are not the chance
        of a crash. General guidance: follow applicable road rules and adjust
        driving to conditions; this model cannot establish that a scenario is
        safe.
      </Limitation>
      <div className="actions">
        <button
          className="button small"
          onClick={() => void copy(summary, "Prediction summary copied.")}
        >
          <Copy size={13} /> Copy summary
        </button>
        <button
          className="button small"
          onClick={() => {
            const url = `${location.origin}/predict?scenario=${shareScenario(prediction.scenario)}`;
            void copy(
              url,
              "Hypothetical scenario link copied. Model results are not embedded.",
            );
          }}
        >
          <Share2 size={13} /> Share scenario
        </button>
        <button
          className="button small"
          onClick={() =>
            downloadText(
              `roadsentinel-${prediction.id.slice(0, 8)}.json`,
              JSON.stringify(prediction, null, 2),
              "application/json",
            )
          }
        >
          <Download size={13} /> Export JSON
        </button>
        {prediction.saved && (
          <Link href={`/history?id=${prediction.id}`} className="text-link">
            <ExternalLink size={13} /> Open saved record
          </Link>
        )}
      </div>
      {feedback && (
        <p role="status" className="toast" style={{ marginTop: 14 }}>
          <Check size={13} style={{ display: "inline", marginRight: 5 }} />
          {feedback}
        </p>
      )}
      <p className="chart-annotation mono">{prediction.id}</p>
    </Panel>
  );
}
