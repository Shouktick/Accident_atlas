import { z } from "zod";

export const scenarioSchema = z.object({
  Age_of_Driver: z.number().int().min(16).max(100),
  Speed_limit: z.number().int().min(10).max(140),
  Weather_Conditions: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  Road_Surface_Conditions: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  Light_Conditions: z.union([
    z.literal(1),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  Vehicle_Type: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(5),
    z.literal(8),
    z.literal(11),
  ]),
  Number_of_Vehicles: z.number().int().min(1).max(20),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export const defaults: Scenario = {
  Age_of_Driver: 35,
  Speed_limit: 30,
  Weather_Conditions: 1,
  Road_Surface_Conditions: 1,
  Light_Conditions: 1,
  Vehicle_Type: 1,
  Number_of_Vehicles: 1,
};

export const explanationSchema = z.object({
  class_id: z.string(),
  base_value: z.number(),
  output_value: z.number(),
  output_space: z.string(),
  method: z.string(),
  contributions: z.array(
    z.object({
      feature: z.string(),
      value: z.number(),
      contribution: z.number(),
    }),
  ),
});
export const predictionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  model_version: z.string(),
  scenario: scenarioSchema,
  class_id: z.string(),
  severity: z.string(),
  semantics_verified: z.boolean(),
  probabilities: z.array(
    z.object({
      class_id: z.string(),
      label: z.string(),
      probability: z.number().min(0).max(1),
    }),
  ),
  confidence: z.number().min(0).max(1),
  calibrated: z.boolean(),
  risk_score: z.number().min(0).max(100).nullable(),
  latency_ms: z.number().min(0),
  explanation: explanationSchema.nullable(),
  explanation_status: z.string(),
  saved: z.boolean(),
});
export type Prediction = z.infer<typeof predictionSchema>;
export const healthSchema = z.object({
  status: z.string(),
  model_available: z.boolean(),
  model_version: z.string().nullable(),
  ready: z.boolean(),
  severity_ready: z.boolean(),
  database_available: z.boolean(),
  history_durable: z.boolean(),
  semantics_verified: z.boolean(),
  shap_available: z.boolean(),
});
export const metadataSchema = z.object({
  model_version: z.string(),
  algorithm: z.string(),
  feature_order: z.array(z.string()),
  classes: z.array(z.object({ id: z.string(), label: z.string() })),
  semantics_verified: z.boolean(),
  speed_unit: z.string(),
  calibrated: z.boolean(),
  provenance: z.string(),
  limitations: z.array(z.string()),
});

export function convertSpeed(
  value: number,
  from: "km/h" | "mph",
  to: "km/h" | "mph",
) {
  return from === to
    ? value
    : from === "mph"
      ? value * 1.609344
      : value / 1.609344;
}
export function shareScenario(scenario: Scenario) {
  return encodeURIComponent(JSON.stringify(scenarioSchema.parse(scenario)));
}
export function readSharedScenario(value: string): Scenario | null {
  try {
    return scenarioSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}
