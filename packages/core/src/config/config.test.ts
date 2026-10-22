import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_CONFIG, configHash, resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  it("returns defaults and merges layers with later layers winning", () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
    const c = resolveConfig({ budgets: { maxFiles: 10 }, exclude: ["a"] }, { budgets: { maxFileBytes: 5 }, history: { enabled: false } });
    expect(c.budgets.maxFiles).toBe(10);
    expect(c.budgets.maxFileBytes).toBe(5);
    expect(c.budgets.maxTotalBytes).toBe(DEFAULT_CONFIG.budgets.maxTotalBytes);
    expect(c.history.enabled).toBe(false);
    expect(c.exclude).toEqual(["a"]);
  });
  it("rejects unknown keys and invalid values", () => {
    expect(() => resolveConfig({ nope: 1 } as never)).toThrow(ConfigError);
    expect(() => resolveConfig({ budgets: { maxFiles: -1 } })).toThrow(/positive/);
    expect(() => resolveConfig({ complexity: { moderate: 30, high: 20, veryHigh: 50 } })).toThrow(/increase/);
    expect(() => resolveConfig({ history: { authors: "x" as never } })).toThrow(/authors/);
  });
  it("hashes deterministically and detects changes", () => {
    expect(configHash(resolveConfig())).toBe(configHash(resolveConfig()));
    expect(configHash(resolveConfig({ moduleDepth: 2 }))).not.toBe(configHash(resolveConfig()));
  });
  it("does not mutate the defaults", () => {
    resolveConfig({ budgets: { maxFiles: 1 } });
    expect(DEFAULT_CONFIG.budgets.maxFiles).toBe(20_000);
  });
});
