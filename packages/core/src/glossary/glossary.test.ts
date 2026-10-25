import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../scoring/profile.js";
import { DIMENSION_LABELS, explain, GLOSSARY, GLOSSARY_INDEX } from "./glossary.js";

describe("glossary", () => {
  it("has a complete entry for every score dimension and every score input", () => {
    for (const [dim, inputs] of Object.entries(DEFAULT_PROFILE.dimensions)) {
      expect(GLOSSARY_INDEX.has(dim)).toBe(true);
      for (const i of inputs) expect(GLOSSARY_INDEX.has(i.name)).toBe(true);
    }
  });
  it("answers the five questions for every term, with unique ids and no dashes used as punctuation", () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) {
      for (const f of [g.label, g.plain, g.technical, g.why, g.calculation, g.improve]) {
        expect(f.trim().length).toBeGreaterThan(0);
        expect(f.includes("\u2014")).toBe(false);
      }
    }
  });
  it("exposes labels for dimensions and lookup by id", () => {
    expect(DIMENSION_LABELS["testing-ci"]).toBe("Testing and CI");
    expect(explain("blast-radius")?.label).toBe("Blast radius");
    expect(explain("nope")).toBeNull();
  });
});
