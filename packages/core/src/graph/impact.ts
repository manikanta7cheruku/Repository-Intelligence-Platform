import type { BlastRadiusEntry, GraphModel } from "../ir/types.js";

export interface ReverseIndex {
  rev: Map<string, { id: string; typeOnly: boolean }[]>;
  idByPath: Map<string, string>;
  pathById: Map<string, string>;
  modulePathById: Map<string, string>;
  entrypointIds: Set<string>;
}

export function buildReverseIndex(graph: GraphModel, entrypointPaths: readonly string[]): ReverseIndex {
  const idByPath = new Map(graph.nodes.map((n) => [n.path, n.id]));
  const pathById = new Map(graph.nodes.map((n) => [n.id, n.path]));
  const modulePath = new Map(graph.modules.map((m) => [m.id, m.path]));
  const modulePathById = new Map(graph.nodes.map((n) => [n.id, modulePath.get(n.moduleId) ?? n.moduleId]));
  const rev = new Map<string, { id: string; typeOnly: boolean }[]>();
  for (const e of graph.edges) (rev.get(e.to) ?? rev.set(e.to, []).get(e.to))?.push({ id: e.from, typeOnly: e.typeOnly });
  const entrypointIds = new Set(entrypointPaths.map((p) => idByPath.get(p)).filter((x): x is string => x !== undefined));
  return { rev, idByPath, pathById, modulePathById, entrypointIds };
}

/** Everything that could be affected when `path` changes: reverse reachability over the import graph. */
export function impactOf(idx: ReverseIndex, path: string): BlastRadiusEntry | null {
  const start = idx.idByPath.get(path);
  if (start === undefined) return null;
  const depth = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: string[] = [];
    for (const v of frontier) {
      for (const { id } of idx.rev.get(v) ?? []) {
        if (!depth.has(id)) {
          depth.set(id, d);
          next.push(id);
        }
      }
    }
    frontier = next;
  }
  // Runtime-only reach (ignore type-only edges)
  const runtime = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const v = queue.pop() as string;
    for (const { id, typeOnly } of idx.rev.get(v) ?? []) {
      if (!typeOnly && !runtime.has(id)) {
        runtime.add(id);
        queue.push(id);
      }
    }
  }
  const affected = [...depth.keys()];
  const modules = [...new Set(affected.map((id) => idx.modulePathById.get(id) ?? ""))].filter(Boolean).sort();
  const entries = affected.filter((id) => idx.entrypointIds.has(id)).map((id) => idx.pathById.get(id) as string).sort();
  return {
    path,
    directDependents: (idx.rev.get(start) ?? []).length,
    transitiveDependents: depth.size - 1,
    runtimeTransitive: runtime.size - 1,
    modulesAffected: modules,
    entrypointsAffected: entries,
    maxDepth: Math.max(0, ...depth.values()),
  };
}

export function computeBlastRadius(graph: GraphModel, entrypointPaths: readonly string[], top = 20): BlastRadiusEntry[] {
  const idx = buildReverseIndex(graph, entrypointPaths);
  const candidates = graph.nodes.length <= 3000 ? graph.nodes : [...graph.nodes].sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path)).slice(0, 300);
  const entries: BlastRadiusEntry[] = [];
  for (const n of candidates) {
    const e = impactOf(idx, n.path);
    if (e && e.transitiveDependents > 0) entries.push(e);
  }
  entries.sort((a, b) => b.transitiveDependents - a.transitiveDependents || b.directDependents - a.directDependents || a.path.localeCompare(b.path));
  return entries.slice(0, top);
}
