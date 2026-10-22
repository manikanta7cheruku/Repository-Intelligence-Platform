import { describe, expect, it } from "vitest";
import { applyCurve } from "./profile.js";
import { buildRecommendations } from "./recommend.js";
import type { Finding } from "../ir/types.js";

describe("applyCurve", () => {
  const curve: [number, number][] = [[0, 100], [0.1, 50], [0.3, 0]];
  it("interpolates linearly and clamps outside the range", () => {
    expect(applyCurve(curve, 0)).toBe(100);
    expect(applyCurve(curve, 0.05)).toBeCloseTo(75, 6);
    expect(applyCurve(curve, 0.2)).toBeCloseTo(25, 6);
    expect(applyCurve(curve, 5)).toBe(0);
    expect(applyCurve(curve, -1)).toBe(100);
  });
  it("supports increasing curves", () => {
    const inc: [number, number][] = [[0, 0], [1, 100]];
    expect(applyCurve(inc, 0.25)).toBe(25);
    expect(applyCurve(inc, 2)).toBe(100);
  });
  it("supports curves whose x values decrease in score order (author concentration style)", () => {
    const c: [number, number][] = [[0.3, 100], [0.6, 70], [0.9, 30], [1, 10]];
    expect(applyCurve(c, 0.1)).toBe(100);
    expect(applyCurve(c, 0.75)).toBe(50);
    expect(applyCurve(c, 1)).toBe(10);
  });
});

const finding = (id: string, ruleId: string, severity: Finding["severity"], confidence: Finding["confidence"] = "high", category: Finding["category"] = "quality"): Finding => ({
  id, title: id, category, ruleId, severity, confidence, origin: "observed", classification: null, explanation: "", evidence: [], locations: [], remediation: "", limitations: [], tags: [],
});

describe("buildRecommendations", () => {
  it("groups by rule, ranks by severity times confidence, and skips info and analysis findings", () => {
    const recs = buildRecommendations([
      finding("RL-A-1", "security.osv", "critical", "high", "security"), finding("RL-A-2", "security.osv", "high", "high", "security"),
      finding("RL-B-1", "arch.cycle.file", "medium"), finding("RL-C-1", "quality.large-file", "low"),
      finding("RL-D-1", "arch.unreachable-files", "info"), finding("RL-E-1", "analysis.truncated", "medium", "high", "analysis"),
    ]);
    expect(recs.map((r) => r.title)).toEqual(["Upgrade 2 vulnerable dependencies", "Break 1 circular dependency between files", "Split 1 very large file"]);
    expect(recs.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(recs[0]?.findingIds).toEqual(["RL-A-1", "RL-A-2"]);
    expect(recs[0]?.effort).toBe("low");
  });
  it("lets low confidence reduce priority", () => {
    const recs = buildRecommendations([finding("RL-1", "arch.cycle.file", "medium", "low"), finding("RL-2", "quality.large-file", "medium", "high")]);
    expect(recs[0]?.title).toMatch(/Split/);
  });
  it("returns an empty list when there is nothing actionable", () => {
    expect(buildRecommendations([])).toEqual([]);
  });
});
