"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { MapPinned } from "lucide-react";
import { z } from "zod";
import { api, downloadText } from "@/lib/api";
import { options } from "./ScenarioForm";
import { Limitation, Loading, PageTitle, Panel } from "./ui";

const Map = dynamic(() => import("./GeographicMap"), {
  ssr: false,
  loading: () => <Loading message="Loading geographic renderer…" />,
});
const hotspotSchema = z.object({
  provenance: z.object({
    source: z.string(),
    sha256: z.string(),
    record_count: z.number(),
  }),
  total: z.number(),
  truncated: z.boolean(),
  items: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
      severity: z.string(),
      city: z.string(),
    }),
  ),
});
export default function HotspotWorkspace() {
  const [severity, setSeverity] = useState(""),
    [weather, setWeather] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [hour, setHour] = useState(""),
    [city, setCity] = useState("");
  const data = useQuery({
    queryKey: ["hotspots", severity, weather, vehicle, hour],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({
        severity,
        weather,
        vehicle,
        hour,
      }))
        if (value) params.set(key, value);
      return api(`hotspots?${params}`, hotspotSchema);
    },
    retry: false,
  });
  const points = data.data?.items.filter((p) => !city || p.city === city) || [];
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="INTELLIGENCE / INDIA MAP"
        title="Geography needs grounded evidence."
        description="Only verified source coordinates can be presented as observed accident locations."
      />
      <Panel
        title="India accident observations"
        subtitle="Source records, not model-generated coordinates"
      >
        {data.isPending ? (
          <Loading />
        ) : data.error ? (
          <>
            <div className="map-unavailable">
              <MapPinned size={42} />
              <strong>Observed locations are unavailable</strong>
              <p>{data.error.message}</p>
              <span className="tag">NO ILLUSTRATIVE ACCIDENTS DISPLAYED</span>
            </div>
            <div className="doc-content">
              <h3>Why this map has no accident points</h3>
              <p>
                The original project used hand-entered city coordinates without
                an observational source. Those records have been removed. No
                evidence currently establishes India coverage or precise
                accident coordinates.
              </p>
              <p>
                A reviewed geographic dataset with source, license, severity
                codebook, and valid coordinates is needed to activate
                observation filters and geographic statistics. City centroids
                will not be labelled as accident locations.
              </p>
            </div>
            <button
              className="button small"
              style={{ marginTop: 18 }}
              onClick={() => void data.refetch()}
            >
              Check dataset availability
            </button>
          </>
        ) : (
          data.data && (
            <>
              <p className="chart-annotation">
                Source: {data.data.provenance.source} · {data.data.total}{" "}
                matching records within the India view bounds. Bounding-box
                filtering does not establish country membership near borders.
              </p>
              <div className="filters" style={{ margin: "20px 0" }}>
                {[
                  {
                    id: "severity",
                    label: "Source severity",
                    value: severity,
                    set: setSeverity,
                    values: [
                      ["Fatal", "Fatal"],
                      ["Serious", "Serious"],
                      ["Slight", "Slight"],
                    ],
                  },
                  {
                    id: "weather",
                    label: "Weather code",
                    value: weather,
                    set: setWeather,
                    values: options.Weather_Conditions.map(([c, l]) => [
                      String(c),
                      l,
                    ]),
                  },
                  {
                    id: "vehicle",
                    label: "Vehicle code",
                    value: vehicle,
                    set: setVehicle,
                    values: options.Vehicle_Type.map(([c, l]) => [
                      String(c),
                      l,
                    ]),
                  },
                  {
                    id: "hour",
                    label: "Hour (UTC)",
                    value: hour,
                    set: setHour,
                    values: Array.from({ length: 24 }, (_, i) => [
                      String(i),
                      `${i}:00`,
                    ]),
                  },
                ].map((filter) => (
                  <div className="field" key={filter.id}>
                    <label htmlFor={`map-${filter.id}`}>{filter.label}</label>
                    <select
                      id={`map-${filter.id}`}
                      value={filter.value}
                      onChange={(e) => {
                        filter.set(e.target.value);
                        setCity("");
                      }}
                    >
                      <option value="">All</option>
                      {filter.values.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="field">
                <label htmlFor="map-city">
                  City drill-down · displayed records
                </label>
                <select
                  id="map-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="">All listed cities</option>
                  {Array.from(new Set(data.data.items.map((p) => p.city)))
                    .sort()
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
              </div>
              <div className="map-frame">
                <Map points={points} />
              </div>
              <div className="chart-legend">
                <span style={{ color: "var(--red)" }}>Fatal</span>
                <span style={{ color: "var(--amber)" }}>Serious</span>
                <span style={{ color: "var(--teal)" }}>Slight</span>
              </div>
              <p className="chart-annotation">
                {points.length} displayed source records
                {data.data.truncated ? "; response capped at 2,000 points" : ""}
                . This view uses observation markers, not a calculated density
                heat layer.
              </p>
              {data.data.truncated && (
                <Limitation>
                  The point response is truncated. Displayed city counts do not
                  represent the full dataset.
                </Limitation>
              )}
              <button
                className="button small"
                style={{ marginTop: 15 }}
                onClick={() =>
                  downloadText(
                    "roadsentinel-geography.json",
                    JSON.stringify({ ...data.data, items: points }, null, 2),
                    "application/json",
                  )
                }
              >
                Export displayed records
              </button>
            </>
          )
        )}
      </Panel>
    </div>
  );
}
