import { describe, expect, it } from "vitest";
import type { GraphModel } from "../ir/types.js";
import { fileIdFor, moduleIdFor } from "../util/hash.js";
import { buildReverseIndex, computeBlastRadius, impactOf } from "./impact.js";

function graph(edges: [string, string, boolean?][], modules: Record<string, string>): GraphModel {
  const paths = [...new Set(edges.flatMap((e) => [e[0], e[1]]))];
  const modPaths = [...new Set(Object.values(modules))];
  return {
    nodes: paths.map((p) => ({
      id: fileIdFor(p),
      path: p,
      moduleId: moduleIdFor(modules[p] ?? "m"),
      fanIn: edges.filter((e) => e[1] === p).length,
      fanOut: 0,
    })),
    edges: edges.map(([a, b, t]) => ({
      from: fileIdFor(a),
      to: fileIdFor(b),
      weight: 1,
      typeOnly: t ?? false,
      occurrences: [],
    })),
    modules: modPaths.map((m) => ({
      id: moduleIdFor(m),
      path: m,
      kind: "directory" as const,
      fileCount: 1,
      loc: 1,
      fanIn: 0,
      fanOut: 0,
      instability: null,
      origin: "observed" as const,
    })),
    moduleEdges: [],
    cycles: [],
    levels: [],
    entrypointReachable: { analyzable: false, reachableFiles: null, unreachableFiles: null },
    resolution: { internalImports: 0, resolved: 0, unresolved: 0, external: 0, ratio: null },
  };
}

describe("impactOf", () => {
  const g = graph(
    [
      ["app.ts", "svc.ts"],
      ["svc.ts", "db.ts"],
      ["cli.ts", "db.ts"],
      ["types.ts", "db.ts", true],
    ].map(([a, b, t]) => [a, b, t] as [string, string, boolean?]),
    { "app.ts": "entry", "svc.ts": "core", "db.ts": "data", "cli.ts": "entry", "types.ts": "data" },
  );
  const idx = buildReverseIndex(g, ["app.ts", "cli.ts"]);
  it("counts direct and transitive dependents, modules and entrypoints", () => {
    const e = impactOf(idx, "db.ts");
    expect(e).toMatchObject({ directDependents: 3, transitiveDependents: 4, maxDepth: 2 });
    expect(e?.entrypointsAffected).toEqual(["app.ts", "cli.ts"]);
    expect(e?.modulesAffected).toEqual(["core", "data", "entry"]);
  });
  it("separates runtime reach from type-only reach", () => {
    expect(impactOf(idx, "db.ts")?.runtimeTransitive).toBe(3);
  });
  it("returns zero dependents for a leaf and null for unknown files", () => {
    expect(impactOf(idx, "app.ts")?.transitiveDependents).toBe(0);
    expect(impactOf(idx, "missing.ts")).toBeNull();
  });
  it("handles cycles without looping forever", () => {
    const c = graph(
      [
        ["a.ts", "b.ts"],
        ["b.ts", "a.ts"],
      ],
      { "a.ts": "m", "b.ts": "m" },
    );
    expect(impactOf(buildReverseIndex(c, []), "a.ts")).toMatchObject({
      transitiveDependents: 1,
      directDependents: 1,
    });
  });
  it("ranks files by transitive dependents", () => {
    const top = computeBlastRadius(g, ["app.ts"], 3);
    expect(top[0]?.path).toBe("db.ts");
    expect(top.every((t) => t.transitiveDependents > 0)).toBe(true);
  });
});
