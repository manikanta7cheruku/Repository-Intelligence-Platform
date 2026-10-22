import { describe, expect, it } from "vitest";
import { YamlSubsetError, parseYamlSubset } from "./yaml.js";

describe("parseYamlSubset", () => {
  it("parses maps, lists of maps, inline lists, scalars and comments", () => {
    const doc = parseYamlSubset(`
# comment
version: 1
layers:
  - name: ui
    paths: ["src/ui/**", 'src/x']
  - name: domain
    paths:
      - src/domain/**
flag: true
nothing: null
ratio: 0.5
text: "a # not comment"
`);
    expect(doc).toEqual({
      version: 1,
      layers: [
        { name: "ui", paths: ["src/ui/**", "src/x"] },
        { name: "domain", paths: ["src/domain/**"] },
      ],
      flag: true,
      nothing: null,
      ratio: 0.5,
      text: "a # not comment",
    });
  });
  it("parses nested maps inside list items", () => {
    expect(
      parseYamlSubset(
        "rules:\n  - id: r1\n    forbid:\n      from: a\n      to: b\n    severity: high\n",
      ),
    ).toEqual({ rules: [{ id: "r1", forbid: { from: "a", to: "b" }, severity: "high" }] });
  });
  it("rejects unsupported constructs with a line number", () => {
    for (const bad of ["a: &anchor 1", "a: {x: 1}", "a: |\n  text", "a: 1\na: 2", "\tkey: 1"]) {
      let err: unknown;
      try {
        parseYamlSubset(bad);
      } catch (e) {
        err = e;
      }
      expect(err instanceof YamlSubsetError).toBe(true);
    }
  });
  it("returns an empty map for an empty document", () => {
    expect(parseYamlSubset("# only a comment\n")).toEqual({});
  });
});
