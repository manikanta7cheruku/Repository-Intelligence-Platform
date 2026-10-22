import { describe, expect, it } from "vitest";
import { findCycles, stronglyConnectedComponents, buildAdjacency } from "./scc.js";

const edges = (pairs: [string, string][]) => pairs.map(([from, to]) => ({ from, to }));

describe("stronglyConnectedComponents", () => {
  it("finds a simple cycle and ignores the acyclic part", () => {
    const e = edges([
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
      ["d", "a"],
    ]);
    expect(findCycles(["a", "b", "c", "d"], e)).toEqual([["a", "b", "c"]]);
  });
  it("finds two separate cycles in a stable order", () => {
    const e = edges([
      ["x", "y"],
      ["y", "x"],
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(findCycles(["x", "y", "a", "b"], e)).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });
  it("returns nothing for a DAG and for self loops only", () => {
    expect(findCycles(["a", "b"], edges([["a", "b"]]))).toEqual([]);
    expect(findCycles(["a"], edges([["a", "a"]]))).toEqual([]);
  });
  it("handles a very deep chain without stack overflow", () => {
    const n = 50_000;
    const nodes = Array.from({ length: n }, (_, i) => `n${i}`);
    const e = nodes.slice(1).map((to, i) => ({ from: nodes[i] as string, to }));
    e.push({ from: nodes[n - 1] as string, to: nodes[0] as string });
    const comps = stronglyConnectedComponents(nodes, buildAdjacency(nodes, e));
    expect(comps.filter((c) => c.length > 1)).toHaveLength(1);
    expect(comps.find((c) => c.length > 1)?.length).toBe(n);
  });
});
