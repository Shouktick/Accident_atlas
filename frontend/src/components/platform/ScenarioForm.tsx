"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import {
  convertSpeed,
  defaults,
  readSharedScenario,
  Scenario,
  scenarioSchema,
} from "@/lib/contracts";
import Speedometer from "./Speedometer";
import { labels, Limitation, useMetadata } from "./ui";

export const options: Record<string, [number, string][]> = {
  Weather_Conditions: [
    [1, "Fine"],
    [2, "Rain"],
    [3, "Snow"],
    [4, "Fine + wind"],
    [5, "Rain + wind"],
    [6, "Snow + wind"],
    [7, "Fog / mist"],
  ],
  Road_Surface_Conditions: [
    [1, "Dry"],
    [2, "Wet / damp"],
    [3, "Snow"],
    [4, "Frost / ice"],
    [5, "Flood"],
  ],
  Light_Conditions: [
    [1, "Daylight"],
    [4, "Dark · lights lit"],
    [5, "Dark · lights unlit"],
    [6, "Dark · no lights"],
  ],
  Vehicle_Type: [
    [1, "Car"],
    [2, "Motorcycle"],
    [5, "Bus"],
    [8, "Van"],
    [11, "HGV"],
  ],
};
export const presets = [
  {
    name: "Rainy night",
    values: {
      ...defaults,
      Speed_limit: 70,
      Weather_Conditions: 2,
      Road_Surface_Conditions: 2,
      Light_Conditions: 5,
    } as Scenario,
  },
  {
    name: "Urban two-wheeler",
    values: {
      ...defaults,
      Age_of_Driver: 25,
      Speed_limit: 40,
      Vehicle_Type: 2,
      Number_of_Vehicles: 2,
    } as Scenario,
  },
  {
    name: "Clear residential",
    values: { ...defaults, Speed_limit: 30 } as Scenario,
  },
];

export default function ScenarioForm({
  onSubmit,
  pending,
  submitLabel = "Run model prediction",
  initial = defaults,
  allowSave = true,
  allowShared = false,
}: {
  onSubmit: (scenario: Scenario, save: boolean) => void;
  pending: boolean;
  submitLabel?: string;
  initial?: Scenario;
  allowSave?: boolean;
  allowShared?: boolean;
}) {
  const metadata = useMetadata();
  const [save, setSave] = useState(false),
    [displayUnit, setDisplayUnit] = useState<"km/h" | "mph">("km/h");
  const {
    register,
    control,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<Scenario>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: initial,
  });
  const nativeSpeed = useWatch({ control, name: "Speed_limit" });
  const nativeUnit = metadata.data?.speed_unit;
  const verifiedUnit =
    nativeUnit === "mph" || nativeUnit === "km/h" ? nativeUnit : null;
  const speed = verifiedUnit
    ? convertSpeed(nativeSpeed, verifiedUnit, displayUnit)
    : nativeSpeed;
  useEffect(() => {
    if (allowShared) {
      const shared = new URLSearchParams(window.location.search).get(
        "scenario",
      );
      const parsed = shared ? readSharedScenario(shared) : null;
      if (parsed) reset(parsed);
    }
  }, [allowShared, reset]);
  return (
    <form
      className="scenario-form"
      noValidate
      onSubmit={handleSubmit((scenario) => onSubmit(scenario, save))}
    >
      <Speedometer
        value={Math.round(speed * 10) / 10}
        min={
          verifiedUnit
            ? Math.round(convertSpeed(10, verifiedUnit, displayUnit))
            : 10
        }
        max={
          verifiedUnit
            ? Math.round(convertSpeed(140, verifiedUnit, displayUnit))
            : 140
        }
        unit={verifiedUnit ? displayUnit : "model units · unverified"}
        onChange={(value) =>
          setValue(
            "Speed_limit",
            Math.round(
              verifiedUnit
                ? convertSpeed(value, displayUnit, verifiedUnit)
                : value,
            ),
            { shouldValidate: true },
          )
        }
      />
      {verifiedUnit && (
        <div className="unit-control">
          {(["km/h", "mph"] as const).map((unit) => (
            <button
              type="button"
              key={unit}
              aria-pressed={displayUnit === unit}
              onClick={() => setDisplayUnit(unit)}
            >
              {unit}
            </button>
          ))}
        </div>
      )}
      <div className="preset-row" aria-label="Scenario presets">
        {presets.map((preset) => (
          <button
            className="preset"
            type="button"
            key={preset.name}
            onClick={() => reset(preset.values)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="field-grid">
        {(["Age_of_Driver", "Speed_limit", "Number_of_Vehicles"] as const).map(
          (key) => (
            <div className="field" key={key}>
              <label htmlFor={`${submitLabel}-${key}`}>
                {labels[key]}
                {key === "Speed_limit" ? " (native model value)" : ""}
              </label>
              <input
                id={`${submitLabel}-${key}`}
                type="number"
                min={
                  key === "Age_of_Driver" ? 16 : key === "Speed_limit" ? 10 : 1
                }
                max={
                  key === "Age_of_Driver"
                    ? 100
                    : key === "Speed_limit"
                      ? 140
                      : 20
                }
                {...register(key, { valueAsNumber: true })}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={
                  errors[key] ? `${submitLabel}-${key}-error` : undefined
                }
              />
              {errors[key] && (
                <p className="field-error" id={`${submitLabel}-${key}-error`}>
                  {errors[key]?.message}
                </p>
              )}
            </div>
          ),
        )}
      </div>
      <div className="form-section">
        <h3>ENVIRONMENT & VEHICLE</h3>
        <div className="field-grid">
          {Object.entries(options).map(([key, values]) => (
            <div className="field" key={key}>
              <label htmlFor={`${submitLabel}-${key}`}>{labels[key]}</label>
              <select
                id={`${submitLabel}-${key}`}
                {...register(key as keyof Scenario, { valueAsNumber: true })}
                aria-invalid={Boolean(errors[key as keyof Scenario])}
              >
                {values.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} · {code}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      <p
        className="microcopy"
        style={{ textAlign: "left", maxWidth: "none", marginTop: 17 }}
      >
        Category names follow the original UI. Their training semantics are
        unverified. Presets are hypothetical input combinations.
      </p>
      {allowSave && (
        <div className="form-section">
          <label className="check-label">
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
            />
            <span>
              Save to history
              <br />
              <small>
                Store this scenario and its result on the backend, scoped to
                this browser session.
              </small>
            </span>
          </label>
        </div>
      )}
      <div className="actions">
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ArrowUpRight size={16} />
          )}
          {pending ? "Running actual model…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function ControlledScenario({
  value,
  onChange,
  id,
}: {
  value: Scenario;
  onChange: (value: Scenario) => void;
  id: string;
}) {
  const parsed = scenarioSchema.safeParse(value);
  return (
    <div>
      <Speedometer
        value={Number.isFinite(value.Speed_limit) ? value.Speed_limit : 10}
        compact
        onChange={(speed) => onChange({ ...value, Speed_limit: speed })}
        unit="native model units"
      />
      <div className="preset-row">
        {presets.map((preset) => (
          <button
            key={preset.name}
            className="preset"
            onClick={() => onChange(preset.values)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="field-grid">
        {Object.keys(defaults).map((key) => (
          <div className="field" key={key}>
            <label htmlFor={`${id}-${key}`}>{labels[key]}</label>
            {options[key] ? (
              <select
                id={`${id}-${key}`}
                value={value[key as keyof Scenario]}
                onChange={(event) =>
                  onChange({ ...value, [key]: Number(event.target.value) })
                }
              >
                {options[key].map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} · {code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${id}-${key}`}
                type="number"
                value={
                  Number.isFinite(value[key as keyof Scenario])
                    ? value[key as keyof Scenario]
                    : ""
                }
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]:
                      event.target.value === ""
                        ? NaN
                        : Number(event.target.value),
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
      {!parsed.success && (
        <p className="field-error" role="alert">
          {parsed.error.issues
            .map(
              (issue) => `${labels[String(issue.path[0])]}: ${issue.message}`,
            )
            .join(" · ")}
        </p>
      )}
      <Limitation>
        Native model units and category names remain unverified.
      </Limitation>
    </div>
  );
}
