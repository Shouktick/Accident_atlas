"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { z } from "zod";
import { api, downloadText } from "@/lib/api";
import { options } from "./ScenarioForm";
import { Limitation, Loading, PageTitle, Panel, Stat } from "./ui";

const sourceSchema = z.object({
  source: z.string(),
  sha256: z.string(),
  record_count: z.number(),
});
const overviewSchema = z.object({
  provenance: sourceSchema,
  row_count: z.number(),
  distribution: z.array(z.object({ label: z.string(), count: z.number() })),
  missing_values: z.number(),
  duplicate_rows: z.number(),
});
const aggregateSchema = z.object({
  provenance: sourceSchema,
  denominator: z.number(),
  dimension: z.string(),
  items: z.array(
    z.object({ group: z.string(), label: z.string(), count: z.number() }),
  ),
});
const dimensions = [
  ["weather", "Weather"],
  ["road-surface", "Road surface"],
  ["lighting", "Lighting"],
  ["vehicle", "Vehicle"],
  ["age-groups", "Age group"],
  ["speed-bands", "Speed band"],
  ["hourly", "Hour of day"],
  ["weekday", "Weekday"],
];
export default function AnalyticsExplorer() {
  const [dimension, setDimension] = useState("weather"),
    [weather, setWeather] = useState(""),
    [vehicle, setVehicle] = useState("");
  const overview = useQuery({
    queryKey: ["dataset-overview"],
    queryFn: () => api("insights/overview", overviewSchema),
    retry: false,
  });
  const aggregate = useQuery({
    queryKey: ["aggregate", dimension, weather, vehicle],
    queryFn: () => {
      const params = new URLSearchParams();
      if (weather) params.set("weather", weather);
      if (vehicle) params.set("vehicle", vehicle);
      return api(`insights/${dimension}?${params}`, aggregateSchema);
    },
    enabled: Boolean(overview.data),
    retry: false,
  });
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="INTELLIGENCE / ANALYTICS"
        title="Explore the evidence, not a simulation."
        description="Dataset aggregates are kept separate from model evaluation and application activity."
      />
      {overview.isPending ? (
        <Loading />
      ) : overview.error ? (
        <Panel
          title="Dataset analytics unavailable"
          subtitle="No source records were supplied"
        >
          <Limitation>
            {overview.error.message} The original training dataset is not
            available, so severity distributions, hourly patterns, and category
            comparisons cannot be calculated honestly.
          </Limitation>
          <div className="doc-content">
            <h3>What is needed to activate this explorer</h3>
            <ol>
              <li>
                A licensed dataset with documented feature and target meanings.
              </li>
              <li>
                A reviewed manifest identifying its source, fingerprint, target,
                timestamp, and geography where present.
              </li>
              <li>
                Server configuration for the dataset and manifest. No synthetic
                accident data is used as a substitute.
              </li>
            </ol>
            <p>
              Use the Command Center for actual application activity, and the
              Model Card for evaluation status.
            </p>
          </div>
        </Panel>
      ) : (
        overview.data && (
          <>
            <div className="stats-grid">
              <Stat
                label="Source records"
                value={overview.data.row_count.toLocaleString()}
                note="Actual configured source dataset"
              />
              <Stat
                label="Missing values"
                value={String(overview.data.missing_values)}
                note="Across source columns"
              />
              <Stat
                label="Duplicate rows"
                value={String(overview.data.duplicate_rows)}
                note="Exact source-row duplicates"
              />
              <Stat
                label="Source fingerprint"
                value={overview.data.provenance.sha256.slice(0, 8)}
                note={overview.data.provenance.source}
              />
            </div>
            <Panel
              title="Compare source categories"
              subtitle="Weather and vehicle filters apply together to the aggregate"
            >
              <div className="segmented">
                {dimensions.map(([id, name]) => (
                  <button
                    key={id}
                    aria-pressed={dimension === id}
                    onClick={() => setDimension(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="filters" style={{ margin: "23px 0" }}>
                <div className="field">
                  <label htmlFor="analytics-weather">Weather filter</label>
                  <select
                    id="analytics-weather"
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                  >
                    <option value="">All weather codes</option>
                    {options.Weather_Conditions.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label} · {code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="analytics-vehicle">Vehicle filter</label>
                  <select
                    id="analytics-vehicle"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  >
                    <option value="">All vehicle codes</option>
                    {options.Vehicle_Type.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label} · {code}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="button"
                  disabled={!aggregate.data}
                  onClick={() =>
                    downloadText(
                      "roadsentinel-analytics.json",
                      JSON.stringify(aggregate.data, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={14} />
                  Export aggregate
                </button>
              </div>
              {aggregate.isPending ? (
                <Loading />
              ) : aggregate.error ? (
                <Limitation>{aggregate.error.message}</Limitation>
              ) : (
                aggregate.data && (
                  <>
                    <p className="chart-annotation">
                      Source: {aggregate.data.provenance.source} ·{" "}
                      {aggregate.data.denominator} matching records · counts,
                      not model predictions
                    </p>
                    <div className="distribution">
                      {aggregate.data.items.map((row, i) => (
                        <div key={`${row.group}-${row.label}-${i}`}>
                          <div className="bar-label">
                            <span>
                              {row.group} / {row.label}
                            </span>
                            <strong>{row.count} records</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              title={`${row.group}, ${row.label}: ${row.count} source records`}
                              style={{
                                width: `${(row.count / Math.max(1, ...aggregate.data!.items.map((r) => r.count))) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {!aggregate.data.items.length && (
                      <p className="chart-annotation">
                        No source records match these filters.
                      </p>
                    )}
                  </>
                )
              )}
            </Panel>
          </>
        )
      )}
    </div>
  );
}
