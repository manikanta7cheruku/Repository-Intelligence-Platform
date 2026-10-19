import { describe, expect, it } from "vitest";
import { describeEngine, REPORT_SCHEMA_VERSION } from "./index.js";

describe("core skeleton", () => {
  it("exposes the schema version", () => {
    expect(REPORT_SCHEMA_VERSION).toBe("0.0.0");
  });
  it("describes the engine", () => {
    expect(describeEngine()).toContain("report schema");
  });
});
