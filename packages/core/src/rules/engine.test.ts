import { describe, expect, it } from "vitest";
import type { GraphModel } from "../ir/types.js";
import { fileIdFor } from "../util/hash.js";
import { RulesError, applyBaseline, evaluateRules, parseBaseline, parseRules } from "./engine.js";

const RULES = `
version: 1
layers:
  - name: ui
    paths: ["src/ui/**"]
  - name: domain
    paths: ["src/domain/**"]
  - name: data
    paths: ["src/data/**"]
rules:
  - id: domain-not-ui
    severity: high
    forbid:
      from: domain
      to: ui
  - id: data-only-domain
    allowOnly:
      from: data
      to: [domain]
  - id: no-react
    forbid:
      from: domain
      external: ["react*"]
  - id: no-cycles
    forbid: cycles
    scope: files
  - id: small-files
    limit:
      metric: file-code-lines
      max: 10
`;

const graph = (edges: [string, string, number?][]): GraphModel => {
  const paths = [...new Set(edges.flatMap(([a, b]) => [a, b]))];
  return {
    nodes: paths.map((p) => ({ id: fileIdFor(p), path: p, moduleId: "m", fanIn: 0, fanOut: 0 })),
    edges: edges.map(([a, b, line]) => ({
      from: fileIdFor(a),
      to: fileIdFor(b),
      weight: 1,
      typeOnly: false,
      occurrences: [{ line: line ?? 1, specifier: b, kind: "import" as const }],
    })),
    modules: [],
    moduleEdges: [],
    cycles: [{ scope: "file", members: ["src/a.ts", "src/b.ts"], size: 2, typeOnly: false }],
    levels: [],
    entrypointReachable: { analyzable: false, reachableFiles: null, unreachableFiles: null },
    resolution: { internalImports: 0, resolved: 0, unresolved: 0, external: 0, ratio: null },
  };
};

describe("parseRules", () => {
  it("parses a valid file", () => {
    const set = parseRules(RULES, "r.yaml");
    expect(set.layers).toHaveLength(3);
    expect(set.rules.map((r) => r.type)).toEqual([
      "forbid-dependency",
      "allow-only",
      "forbid-external",
      "no-cycles",
      "limit",
    ]);
    expect(set.rules[1]?.severity).toBe("medium");
  });
  it("gives precise errors for invalid files", () => {
    const bad: [string, RegExp][] = [
      ["version: 2", /version: 1/],
      ["version: 1\nbogus: 1", /Unknown top-level/],
      ["version: 1\nrules:\n  - id: Bad_ID\n    forbid: cycles", /lowercase/],
      [
        "version: 1\nlayers:\n  - name: a\n    paths: x\nrules:\n  - id: r\n    forbid:\n      from: a\n      to: nope",
        /unknown layer/,
      ],
      ["version: 1\nrules:\n  - id: r\n    severity: urgent\n    forbid: cycles", /severity/],
      ["version: 1\nrules:\n  - id: r\n    id2: x", /must define/],
      [
        "version: 1\nrules:\n  - id: r\n    forbid: cycles\n  - id: r\n    forbid: cycles",
        /Duplicate/,
      ],
      ["a: &x 1", /Cannot parse/],
    ];
    for (const [text, re] of bad) {
      let err: unknown;
      try {
        parseRules(text, "r.yaml");
      } catch (e) {
        err = e;
      }
      expect(err instanceof RulesError).toBe(true);
      expect(String((err as Error).message)).toMatch(re);
    }
  });
  it("accepts JSON", () => {
    expect(
      parseRules(JSON.stringify({ version: 1, rules: [{ id: "c", forbid: "cycles" }] }), "r.json")
        .rules,
    ).toHaveLength(1);
  });
});

describe("evaluateRules", () => {
  const set = parseRules(RULES, "r.yaml");
  const inputs = (g: GraphModel) => ({
    graph: g,
    externalsByFile: new Map([
      [
        "src/domain/x.ts",
        [
          { pkg: "react-dom", line: 3 },
          { pkg: "lodash", line: 4 },
        ],
      ],
    ]),
    fileCodeLines: new Map([
      ["src/big.ts", 50],
      ["src/small.ts", 5],
    ]),
    functions: [],
  });
  it("reports forbidden layer dependencies with evidence and the import line", () => {
    const out = evaluateRules(set, inputs(graph([["src/domain/a.ts", "src/ui/b.ts", 7]])));
    const f = out.find((x) => x.ruleId === "rule.domain-not-ui");
    expect(f?.severity).toBe("high");
    expect(f?.locations[0]).toEqual({ path: "src/domain/a.ts", startLine: 7, endLine: 7 });
    expect(f?.evidence[0]?.refs).toEqual(["src/domain/a.ts", "src/ui/b.ts"]);
  });
  it("applies allow-only, forbid-external, cycle and limit rules", () => {
    const out = evaluateRules(set, inputs(graph([["src/data/a.ts", "src/ui/b.ts"]])));
    const ids = out.map((f) => f.ruleId).sort();
    expect(ids).toEqual([
      "rule.data-only-domain",
      "rule.no-cycles",
      "rule.no-react",
      "rule.small-files",
    ]);
    expect(out.find((f) => f.ruleId === "rule.no-react")?.title).toMatch(/react-dom/);
  });
  it("produces no violations for a clean graph", () => {
    const clean = { ...graph([["src/ui/a.ts", "src/domain/b.ts"]]), cycles: [] };
    const out = evaluateRules(set, {
      graph: clean,
      externalsByFile: new Map(),
      fileCodeLines: new Map(),
      functions: [],
    });
    expect(out).toEqual([]);
  });
  it("gives stable ids across runs", () => {
    const a = evaluateRules(set, inputs(graph([["src/domain/a.ts", "src/ui/b.ts"]])));
    const b = evaluateRules(set, inputs(graph([["src/domain/a.ts", "src/ui/b.ts"]])));
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
  });
});

describe("baseline", () => {
  it("suppresses accepted findings", () => {
    const set = parseRules(RULES, "r.yaml");
    const out = evaluateRules(set, {
      graph: graph([["src/domain/a.ts", "src/ui/b.ts"]]),
      externalsByFile: new Map(),
      fileCodeLines: new Map(),
      functions: [],
    });
    const baseline = parseBaseline(JSON.stringify({ accepted: [out[0]?.id] }));
    const r = applyBaseline(out, baseline);
    expect(r.suppressed).toBe(1);
    expect(r.kept).toHaveLength(out.length - 1);
  });
  it("rejects malformed baselines", () => {
    expect(() => parseBaseline("nope")).toThrow(RulesError);
    expect(() => parseBaseline('{"accepted": 3}')).toThrow(RulesError);
  });
});
