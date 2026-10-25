import { describe, expect, it } from "vitest";
import type { FileMetrics, GraphModel } from "../ir/types.js";
import { fileIdFor, moduleIdFor } from "../util/hash.js";
import { computeRisk } from "./risk.js";

const N = 8;
const paths = Array.from({ length: N }, (_, i) => `src/f${i}.ts`);
const g: GraphModel = {
  nodes: paths.map((p) => ({
    id: fileIdFor(p),
    path: p,
    moduleId: moduleIdFor("src"),
    fanIn: 0,
    fanOut: 0,
  })),
  // everything depends on f0 (the hub); f1 depends on f2
  edges: paths
    .slice(1)
    .map((p) => ({
      from: fileIdFor(p),
      to: fileIdFor("src/f0.ts"),
      weight: 1,
      typeOnly: false,
      occurrences: [],
    })),
  modules: [
    {
      id: moduleIdFor("src"),
      path: "src",
      kind: "directory",
      fileCount: N,
      loc: 100,
      fanIn: 0,
      fanOut: 0,
      instability: null,
      origin: "observed",
    },
  ],
  moduleEdges: [],
  cycles: [],
  levels: [],
  entrypointReachable: { analyzable: false, reachableFiles: null, unreachableFiles: null },
  resolution: { internalImports: 0, resolved: 0, unresolved: 0, external: 0, ratio: null },
};
const metrics = (cx: Record<string, number>): FileMetrics[] =>
  paths.map((p) => ({
    fileId: fileIdFor(p),
    path: p,
    codeLines: 10,
    commentLines: 0,
    blankLines: 0,
    functions: 1,
    maxComplexity: cx[p] ?? 1,
    totalComplexity: cx[p] ?? 1,
  }));
const base = {
  graph: g,
  entrypoints: [],
  fileStats: null,
  testDirect: new Set<string>(),
  hasTests: true,
  coverage: null,
};

describe("computeRisk", () => {
  it("ranks the complex, widely depended-on, untested file first and explains why", () => {
    const r = computeRisk({ ...base, fileMetrics: metrics({ "src/f0.ts": 40, "src/f3.ts": 12 }) });
    expect(r.assessed).toBe(true);
    expect(r.files[0]?.path).toBe("src/f0.ts");
    expect(r.files[0]?.drivers.join(" ")).toMatch(/complexity/);
    expect(r.files[0]?.drivers.join(" ")).toMatch(/depend/);
    expect(r.files[0]?.risk).toBeGreaterThan(r.files[1]?.risk ?? 100);
  });
  it("lowers risk when tests import the file and uses change frequency when history exists", () => {
    const stats = new Map(paths.map((p, i) => [p, { commits: i === 3 ? 50 : 1, churn: 10 }]));
    const without = computeRisk({
      ...base,
      testDirect: new Set(["src/f0.ts"]),
      fileMetrics: metrics({}),
      fileStats: stats,
    });
    expect(without.files[0]?.path).toBe("src/f3.ts");
    const tested = computeRisk({
      ...base,
      fileMetrics: metrics({}),
      fileStats: stats,
      testDirect: new Set(["src/f0.ts", "src/f3.ts"]),
    });
    expect(tested.files.find((f) => f.path === "src/f3.ts")?.risk).toBeLessThan(
      without.files.find((f) => f.path === "src/f3.ts")?.risk ?? 0,
    );
  });
  it("uses measured coverage when available", () => {
    const hi = computeRisk({
      ...base,
      fileMetrics: metrics({}),
      coverage: new Map([["src/f0.ts", 1]]),
    });
    const lo = computeRisk({
      ...base,
      fileMetrics: metrics({}),
      coverage: new Map([["src/f0.ts", 0]]),
    });
    expect(hi.files.find((f) => f.path === "src/f0.ts")?.risk).toBeLessThan(
      lo.files.find((f) => f.path === "src/f0.ts")?.risk ?? 0,
    );
  });
  it("reports confidence by number of factors and is not assessed for tiny graphs", () => {
    const four = computeRisk({
      ...base,
      fileMetrics: metrics({}),
      fileStats: new Map(paths.map((p) => [p, { commits: 1, churn: 1 }])),
    });
    expect(four.files[0]?.confidence).toBe("high");
    const three = computeRisk({ ...base, fileMetrics: metrics({}) });
    expect(three.files[0]?.confidence).toBe("medium");
    const tiny = computeRisk({
      ...base,
      graph: { ...g, nodes: g.nodes.slice(0, 3) },
      fileMetrics: metrics({}),
    });
    expect(tiny.assessed).toBe(false);
    expect(tiny.reason).toMatch(/Fewer than 5/);
  });
  it("is deterministic", () => {
    const a = computeRisk({ ...base, fileMetrics: metrics({ "src/f2.ts": 9 }) });
    const b = computeRisk({ ...base, fileMetrics: metrics({ "src/f2.ts": 9 }) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
