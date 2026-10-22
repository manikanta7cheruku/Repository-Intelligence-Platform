import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../config/config.js";
import { detectDuplication } from "./duplication.js";

const block = (prefix: string) =>
  Array.from({ length: 10 }, (_, i) => `const ${prefix}${i} = computeSomethingLong(${i}, "argument number ${i}", options);`).join("\n");

describe("detectDuplication", () => {
  it("finds a duplicated block across two files", () => {
    const shared = Array.from({ length: 10 }, (_, i) => `doSomethingVeryDescriptive(${i}, "shared argument text ${i}", context);`).join("\n");
    const r = detectDuplication([
      { path: "a.ts", text: `${block("a")}\n${shared}\n`, language: "typescript" },
      { path: "b.ts", text: `${block("b")}\n${shared}\n`, language: "typescript" },
    ], DEFAULT_CONFIG);
    expect(r.assessed).toBe(true);
    expect(r.duplicatedLines).toBeGreaterThanOrEqual(20);
    expect(r.groups[0]?.occurrences.map((o) => o.path).sort()).toEqual(["a.ts", "b.ts"]);
  });
  it("reports zero duplication for distinct code (a real zero, not missing data)", () => {
    const r = detectDuplication([
      { path: "a.ts", text: block("a"), language: "typescript" },
      { path: "b.ts", text: block("b"), language: "typescript" },
    ], DEFAULT_CONFIG);
    expect(r.assessed).toBe(true);
    expect(r.ratio).toBe(0);
  });
  it("is not assessed when there is nothing to analyze", () => {
    const r = detectDuplication([], DEFAULT_CONFIG);
    expect(r.assessed).toBe(false);
    expect(r.ratio).toBeNull();
  });
  it("ignores comment-only and brace-only lines", () => {
    const text = `${"// comment line\n}\n".repeat(20)}`;
    expect(detectDuplication([{ path: "a.ts", text, language: "typescript" }], DEFAULT_CONFIG).assessed).toBe(false);
  });
});
