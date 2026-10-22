import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAgainst, validateReport, reportSchema } from "./schema.js";

describe("validateAgainst", () => {
  const schema = { type: "object", required: ["a"], additionalProperties: false, properties: { a: { type: "integer", minimum: 0 }, b: { type: ["string", "null"], enum: ["x", null] } } };
  it("accepts valid data", () => {
    expect(validateAgainst(schema, { a: 1, b: null })).toEqual([]);
    expect(validateAgainst(schema, { a: 0 })).toEqual([]);
  });
  it("reports missing, wrong type, range, enum and unexpected properties", () => {
    const msgs = (d: unknown) => validateAgainst(schema, d).map((i) => `${i.path}:${i.message}`);
    expect(msgs({})).toEqual(["$.a:required property missing"]);
    expect(msgs({ a: "1" })).toEqual(["$.a:expected integer, got string"]);
    expect(msgs({ a: 1.5 })).toEqual(["$.a:expected integer, got number"]);
    expect(msgs({ a: -1 })).toEqual(["$.a:below minimum 0"]);
    expect(msgs({ a: 1, b: "y" })).toEqual(['$.b:value "y" not in enum']);
    expect(msgs({ a: 1, c: 1 })).toEqual(["$.c:unexpected property"]);
  });
  it("rejects NaN and Infinity", () => {
    expect(validateAgainst({ type: "number" }, Number.NaN)).toHaveLength(1);
    expect(validateAgainst({ type: "number" }, Number.POSITIVE_INFINITY)).toHaveLength(1);
  });
  it("validates array items", () => {
    expect(validateAgainst({ type: "array", items: { type: "string" } }, ["a", 1]).map((i) => i.path)).toEqual(["$[1]"]);
  });
});

describe("published JSON Schema file", () => {
  it("matches the schema used for validation", () => {
    const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "schema", "report.schema.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(JSON.parse(JSON.stringify(reportSchema)));
  });
});

describe("validateReport", () => {
  it("rejects non-objects and wrong schema versions", () => {
    expect(validateReport(null).valid).toBe(false);
    expect(validateReport({}).valid).toBe(false);
  });
});
