import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate, evaluateAll } from "./harness.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "fixtures");

describe("fixture accuracy (regression gate)", () => {
  it("matches the hand-written ground truth for every fixture", async () => {
    const results = await evaluateAll(FIXTURES);
    expect(results.length).toBeGreaterThanOrEqual(12);
    const failures = results.flatMap((r) => r.failures.map((f) => `${r.name}: ${f}`));
    expect(failures).toEqual([]);
    for (const [category, v] of Object.entries(aggregate(results))) {
      expect(`${category} precision ${v.precision}`).toBe(
        `${category} precision ${v.fp === 0 && v.tp >= 0 ? (v.tp + v.fp === 0 ? null : 1) : v.precision}`,
      );
      expect(`${category} recall ${v.recall}`).toBe(
        `${category} recall ${v.fn === 0 ? (v.tp + v.fn === 0 ? null : 1) : v.recall}`,
      );
    }
  });
});
