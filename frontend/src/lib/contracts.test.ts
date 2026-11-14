import { describe, expect, it } from "vitest";
import {
  convertSpeed,
  defaults,
  readSharedScenario,
  scenarioSchema,
  shareScenario,
} from "./contracts";

describe("scenario boundaries", () => {
  it("rejects unsupported categories and missing fields", () => {
    expect(
      scenarioSchema.safeParse({ ...defaults, Vehicle_Type: 99 }).success,
    ).toBe(false);
    expect(scenarioSchema.safeParse({}).success).toBe(false);
    expect(
      scenarioSchema.safeParse({ ...defaults, Speed_limit: -1 }).success,
    ).toBe(false);
  });
  it("round trips a validated share URL and rejects malformed scenarios", () => {
    expect(
      readSharedScenario(decodeURIComponent(shareScenario(defaults))),
    ).toEqual(defaults);
    expect(readSharedScenario("not-json")).toBeNull();
  });
  it("preserves canonical speed across display unit changes", () => {
    expect(convertSpeed(60, "mph", "km/h")).toBeCloseTo(96.56064);
    expect(
      convertSpeed(convertSpeed(60, "mph", "km/h"), "km/h", "mph"),
    ).toBeCloseTo(60);
  });
});
