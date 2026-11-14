"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Database,
  Gauge,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/lib/api";
import { predictionSchema } from "@/lib/contracts";
import Speedometer from "./Speedometer";
import {
  Empty,
  Failure,
  Limitation,
  Loading,
  PageTitle,
  Panel,
  Stat,
  Status,
  useHealth,
  useMetadata,
} from "./ui";

const activitySchema = z.object({
  prediction_count: z.number(),
  saved_count: z.number(),
  average_latency_ms: z.number().nullable(),
  class_distribution: z.array(
    z.object({ class_id: z.string(), count: z.number() }),
  ),
  scope: z.string(),
});
export default function Dashboard() {
  const health = useHealth(),
    metadata = useMetadata();
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: () => api("activity", activitySchema),
  });
  const history = useQuery({
    queryKey: ["history", "recent"],
    queryFn: () =>
      api(
        "predictions?limit=4",
        z.object({ items: z.array(predictionSchema), total: z.number() }),
      ),
  });
  const latest = history.data?.items[0];
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="WORKSPACE / OVERVIEW"
        title="Your road intelligence, in focus."
        description="Explore actual model responses. Understand the evidence behind every output."
      >
        <Link href="/predict" className="button primary">
          <Sparkles size={16} /> New prediction <ArrowUpRight size={16} />
        </Link>
      </PageTitle>
      {health.error && (
        <Failure
          error={health.error}
          retry={() => {
            void health.refetch();
            void activity.refetch();
          }}
        />
      )}
      <div className="stats-grid">
        <Stat
          label="Predictions run"
          value={
            activity.data
              ? activity.data.prediction_count.toLocaleString()
              : "—"
          }
          note="Actual activity · this browser session"
          icon={<Gauge size={17} />}
        />
        <Stat
          label="Model accuracy"
          value="Unverified"
          note="No held-out evaluation artifact"
          icon={<ShieldCheck size={17} />}
        />
        <Stat
          label="Saved scenarios"
          value={activity.data ? String(activity.data.saved_count) : "—"}
          note="Server-side prediction history"
          icon={<Database size={17} />}
        />
        <Stat
          label="Average inference"
          value={
            activity.data?.average_latency_ms != null
              ? `${Math.round(activity.data.average_latency_ms)} ms`
              : "—"
          }
          note="Measured single-prediction requests"
          icon={<Clock3 size={17} />}
        />
      </div>
      <div className="hero-grid">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> SCENARIO INTELLIGENCE
            </p>
            <h2>
              Every scenario
              <br />
              deserves a closer look.
            </h2>
            <p>
              Set the conditions. Inspect class probabilities. See which inputs
              shaped the model&apos;s response.
            </p>
            <Link href="/predict" className="button primary">
              Build a scenario <ArrowRight size={16} />
            </Link>
            <div className="hero-footnote">
              <ShieldCheck size={14} /> Genuine Random Forest inference
            </div>
          </div>
          <div className="hero-gauge">
            <Status>
              {latest ? "LATEST SAVED SCENARIO" : "SCENARIO PREVIEW"}
            </Status>
            <Speedometer
              value={latest?.scenario.Speed_limit ?? 30}
              unit={
                metadata.data?.speed_unit === "unverified"
                  ? "model units · unverified"
                  : (metadata.data?.speed_unit ?? "model units")
              }
            />
            <span className="gauge-caption">
              Posted road limit · not actual vehicle speed
            </span>
          </div>
        </section>
        <Panel
          title="Service readiness"
          subtitle="Live checks, separate from evaluation"
          className="readiness-panel"
        >
          {health.isPending ? (
            <Loading />
          ) : (
            <>
              <div className="readiness-row">
                <span>Inference service</span>
                <Status tone={health.data?.ready ? "good" : "warn"}>
                  {health.data?.ready ? "Ready" : "Unavailable"}
                </Status>
              </div>
              <div className="readiness-row">
                <span>Local Tree SHAP</span>
                <Status tone={health.data?.shap_available ? "good" : "warn"}>
                  {health.data?.shap_available ? "Available" : "Unavailable"}
                </Status>
              </div>
              <div className="readiness-row">
                <span>Severity meanings</span>
                <Status
                  tone={health.data?.semantics_verified ? "good" : "warn"}
                >
                  {health.data?.semantics_verified ? "Verified" : "Unverified"}
                </Status>
              </div>
              <div className="readiness-row">
                <span>History storage</span>
                <strong>
                  {health.data?.history_durable
                    ? "Durable"
                    : "Durability unverified"}
                </strong>
              </div>
              <div className="model-version">
                <small>MODEL VERSION</small>
                <code>{health.data?.model_version ?? "Awaiting backend"}</code>
              </div>
              <Link className="text-link" href="/model-card">
                Read the model card <ArrowUpRight size={15} />
              </Link>
            </>
          )}
        </Panel>
      </div>
      {!metadata.data?.semantics_verified && (
        <Limitation>
          <strong>Transparency by design.</strong> The original dataset and
          codebook are unavailable. Numeric model classes are shown without
          assigning severity meanings. Accuracy, macro F1, severity share, and
          severity-weighted risk are withheld.
        </Limitation>
      )}
      <div className="two-columns">
        <Panel
          title="Model class distribution"
          subtitle="Actual prediction activity · this browser"
          action={<span className="tag">APPLICATION ACTIVITY</span>}
        >
          {activity.isPending ? (
            <Loading />
          ) : activity.error ? (
            <Failure
              error={activity.error}
              retry={() => void activity.refetch()}
            />
          ) : activity.data?.class_distribution.length ? (
            <div className="distribution">
              {activity.data.class_distribution.map((item, i) => (
                <div key={item.class_id}>
                  <div className="bar-label">
                    <span>Class {item.class_id}</span>
                    <strong>
                      {item.count} <small>predictions</small>
                    </strong>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill class-${i}`}
                      style={{
                        width: `${(item.count / activity.data.prediction_count) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your activity starts here"
              href="/predict"
              action="Run a prediction"
            >
              No predictions have been recorded for this browser session.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Explore the workspace"
          subtitle="One model. Several ways to inspect it."
        >
          <div className="tool-links">
            {[
              {
                href: "/what-if",
                title: "Compare two scenarios",
                text: "Inspect how model probabilities change.",
              },
              {
                href: "/batch",
                title: "Process a CSV",
                text: "Validate every row. Export every outcome.",
              },
              {
                href: "/explain",
                title: "Look inside a prediction",
                text: "Signed contributions from real Tree SHAP.",
              },
            ].map((tool) => (
              <Link href={tool.href} key={tool.href}>
                <span>
                  <strong>{tool.title}</strong>
                  <small>{tool.text}</small>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent saved predictions"
        subtitle="Only scenarios you explicitly chose to save"
        action={
          <Link href="/history" className="text-link">
            View history <ArrowRight size={15} />
          </Link>
        }
      >
        {history.isPending ? (
          <Loading />
        ) : history.error ? (
          <Failure error={history.error} retry={() => void history.refetch()} />
        ) : history.data?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Prediction</th>
                  <th>Created</th>
                  <th>Model class</th>
                  <th>Confidence</th>
                  <th>Speed limit</th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="text-link mono"
                        href={`/history?id=${row.id}`}
                      >
                        {row.id.slice(0, 8)} <ArrowUpRight size={12} />
                      </Link>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.severity}</td>
                    <td>{(row.confidence * 100).toFixed(1)}%</td>
                    <td>{row.scenario.Speed_limit} model units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No saved scenarios yet">
            Choose “Save to history” when running a prediction to revisit its
            inputs and explanation.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
