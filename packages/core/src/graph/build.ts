import type { AnalysisConfig } from "../config/config.js";
import type {
  CycleRecord, Dependency, ExternalDependencyRecord, FileRecord, GraphEdge, GraphModel, ModuleRecord,
} from "../ir/types.js";
import { fileIdFor, moduleIdFor } from "../util/hash.js";
import { dirname } from "../util/paths.js";
import { findCycles } from "./scc.js";

const SOURCE_BASES = new Set(["src", "lib", "app"]);

/**
 * Module assignment rule (documented in docs/architecture): nearest package directory (a directory with a
 * package manifest) plus an optional `src`, `lib` or `app` base, plus `depth` further directory levels.
 */
export function moduleOf(path: string, packageDirs: readonly string[], depth: number): { path: string; kind: "package" | "directory" } {
  let pkg = "";
  for (const d of packageDirs) if (d !== "" && (path === d || path.startsWith(`${d}/`)) && d.length > pkg.length) pkg = d;
  const dir = dirname(path);
  const rest = pkg === "" ? dir : dir === pkg ? "" : dir.startsWith(`${pkg}/`) ? dir.slice(pkg.length + 1) : "";
  const segs = rest === "" ? [] : rest.split("/");
  let used = 0;
  if (segs[0] !== undefined && SOURCE_BASES.has(segs[0])) used = 1;
  const take = Math.min(segs.length, used + depth);
  const parts = [...(pkg === "" ? [] : [pkg]), ...segs.slice(0, take)];
  const modulePath = parts.length === 0 ? "(root)" : parts.join("/");
  return { path: modulePath, kind: pkg === "" ? "directory" : "package" };
}

export interface GraphInput {
  files: FileRecord[];
  dependencies: Dependency[];
  packageDirs: string[];
  entrypoints: string[];
  config: AnalysisConfig;
}

export function buildGraph(input: GraphInput): { graph: GraphModel; externals: ExternalDependencyRecord[]; unresolved: Dependency[] } {
  const { files, dependencies, config } = input;
  const nodePaths = new Set(files.map((f) => f.path));
  const moduleByPath = new Map<string, { path: string; kind: "package" | "directory" }>();
  for (const f of files) moduleByPath.set(f.path, moduleOf(f.path, input.packageDirs, config.moduleDepth));

  const edgeMap = new Map<string, GraphEdge & { runtime: boolean }>();
  const external = new Map<string, { builtin: boolean; files: Set<string>; count: number }>();
  const unresolved: Dependency[] = [];
  let resolved = 0;
  let unresolvedCount = 0;
  let externalCount = 0;

  for (const d of dependencies) {
    if (!nodePaths.has(d.fromPath)) continue;
    if (d.resolution === "external" && d.externalPackage) {
      externalCount++;
      const rec = external.get(d.externalPackage) ?? { builtin: d.builtin, files: new Set<string>(), count: 0 };
      rec.files.add(d.fromPath);
      rec.count++;
      external.set(d.externalPackage, rec);
      continue;
    }
    if (d.resolution === "unresolved") {
      unresolvedCount++;
      unresolved.push(d);
      continue;
    }
    if (d.resolution !== "resolved" || !d.toPath) continue;
    resolved++;
    if (!nodePaths.has(d.toPath) || d.toPath === d.fromPath) continue;
    const from = fileIdFor(d.fromPath);
    const to = fileIdFor(d.toPath);
    const key = `${from}>${to}`;
    const typeOnly = d.kind === "type-only";
    const edge = edgeMap.get(key) ?? { from, to, weight: 0, typeOnly: true, occurrences: [], runtime: false };
    edge.weight++;
    if (!typeOnly) {
      edge.typeOnly = false;
      edge.runtime = true;
    }
    if (edge.occurrences.length < 10) edge.occurrences.push({ line: d.line, specifier: d.specifier, kind: d.kind });
    edgeMap.set(key, edge);
  }

  const edges = [...edgeMap.values()].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to));
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const idToPath = new Map(sortedFiles.map((f) => [f.id, f.path]));

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of edges) {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
  }

  const fileIds = sortedFiles.map((f) => f.id);
  const toPathCycle = (members: string[]) => members.map((m) => idToPath.get(m) ?? m).sort();
  const allCycles = findCycles(fileIds, edges);
  const runtimeCycles = findCycles(fileIds, edges.filter((e) => e.runtime));
  const runtimeSets = runtimeCycles.map((c) => new Set(c));
  const cycles: CycleRecord[] = allCycles.map((members) => ({
    scope: "file",
    members: toPathCycle(members),
    size: members.length,
    typeOnly: !runtimeSets.some((s) => members.some((m) => s.has(m))),
  }));

  // Modules
  const moduleFiles = new Map<string, FileRecord[]>();
  for (const f of sortedFiles) {
    const m = (moduleByPath.get(f.path) as { path: string }).path;
    const list = moduleFiles.get(m) ?? [];
    list.push(f);
    moduleFiles.set(m, list);
  }
  const moduleEdgeMap = new Map<string, number>();
  for (const e of edges) {
    const a = (moduleByPath.get(idToPath.get(e.from) as string) as { path: string }).path;
    const b = (moduleByPath.get(idToPath.get(e.to) as string) as { path: string }).path;
    if (a === b) continue;
    const key = `${a}\u0000${b}`;
    moduleEdgeMap.set(key, (moduleEdgeMap.get(key) ?? 0) + 1);
  }
  const moduleEdges = [...moduleEdgeMap.entries()]
    .map(([k, weight]) => {
      const [a, b] = k.split("\u0000") as [string, string];
      return { from: moduleIdFor(a), to: moduleIdFor(b), weight, fromPath: a, toPath: b };
    })
    .sort((x, y) => (x.fromPath + x.toPath).localeCompare(y.fromPath + y.toPath));
  const mFanOut = new Map<string, Set<string>>();
  const mFanIn = new Map<string, Set<string>>();
  for (const e of moduleEdges) {
    (mFanOut.get(e.from) ?? mFanOut.set(e.from, new Set()).get(e.from))?.add(e.to);
    (mFanIn.get(e.to) ?? mFanIn.set(e.to, new Set()).get(e.to))?.add(e.from);
  }
  const modules: ModuleRecord[] = [...moduleFiles.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([path, fs]) => {
      const id = moduleIdFor(path);
      const ce = mFanOut.get(id)?.size ?? 0;
      const ca = mFanIn.get(id)?.size ?? 0;
      return {
        id, path, kind: (moduleByPath.get((fs[0] as FileRecord).path) as { kind: "package" | "directory" }).kind,
        fileCount: fs.length, loc: fs.reduce((s, f) => s + (f.codeLines ?? 0), 0),
        fanIn: ca, fanOut: ce, instability: ca + ce === 0 ? null : Math.round((ce / (ca + ce)) * 1000) / 1000, origin: "observed" as const,
      };
    });
  const moduleIds = modules.map((m) => m.id);
  const idToModulePath = new Map(modules.map((m) => [m.id, m.path]));
  const mAll = findCycles(moduleIds, moduleEdges);
  const mCycles: CycleRecord[] = mAll.map((members) => ({
    scope: "module", members: members.map((m) => idToModulePath.get(m) ?? m).sort(), size: members.length, typeOnly: false,
  }));

  // Levels: 0 = depends on no other module. Cycles collapsed into one level.
  const compOf = new Map<string, string>();
  for (const c of mAll) for (const m of c) compOf.set(m, c[0] as string);
  const rep = (m: string): string => compOf.get(m) ?? m;
  const depsOf = new Map<string, Set<string>>();
  for (const e of moduleEdges) {
    const a = rep(e.from);
    const b = rep(e.to);
    if (a !== b) (depsOf.get(a) ?? depsOf.set(a, new Set()).get(a))?.add(b);
  }
  const levelMemo = new Map<string, number>();
  const levelOf = (m: string): number => {
    const cached = levelMemo.get(m);
    if (cached !== undefined) return cached;
    levelMemo.set(m, 0);
    let lvl = 0;
    for (const d of depsOf.get(m) ?? []) lvl = Math.max(lvl, levelOf(d) + 1);
    levelMemo.set(m, lvl);
    return lvl;
  };
  const levelConfidence = modules.length >= 3 && mAll.length === 0 ? "medium" : "low";
  const levels = modules.map((m) => ({ moduleId: m.id, level: levelOf(rep(m.id)), origin: "inferred" as const, confidence: levelConfidence as "medium" | "low" }));

  // Reachability from entrypoints over runtime and type edges.
  const entryIds = input.entrypoints.filter((p) => nodePaths.has(p)).map(fileIdFor);
  let reachable: number | null = null;
  let unreachable: number | null = null;
  if (entryIds.length > 0) {
    const adj = new Map<string, string[]>();
    for (const e of edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))?.push(e.to);
    const seen = new Set<string>(entryIds);
    const queue = [...entryIds];
    while (queue.length > 0) {
      const v = queue.pop() as string;
      for (const w of adj.get(v) ?? []) if (!seen.has(w)) { seen.add(w); queue.push(w); }
    }
    reachable = seen.size;
    unreachable = fileIds.length - seen.size;
  }

  const internal = resolved + unresolvedCount;
  const graph: GraphModel = {
    nodes: sortedFiles.map((f) => ({
      id: f.id, path: f.path, moduleId: moduleIdFor((moduleByPath.get(f.path) as { path: string }).path),
      fanIn: fanIn.get(f.id) ?? 0, fanOut: fanOut.get(f.id) ?? 0,
    })),
    edges: edges.map(({ runtime: _runtime, ...e }) => e),
    modules,
    moduleEdges: moduleEdges.map(({ from, to, weight }) => ({ from, to, weight })),
    cycles: [...cycles, ...mCycles],
    levels,
    entrypointReachable: { analyzable: entryIds.length > 0, reachableFiles: reachable, unreachableFiles: unreachable },
    resolution: { internalImports: internal, resolved, unresolved: unresolvedCount, external: externalCount, ratio: internal === 0 ? null : Math.round((resolved / internal) * 10000) / 10000 },
  };
  const externals: ExternalDependencyRecord[] = [...external.entries()]
    .map(([name, v]) => ({ name, builtin: v.builtin, importingFiles: v.files.size, importCount: v.count }))
    .sort((a, b) => b.importingFiles - a.importingFiles || a.name.localeCompare(b.name));
  unresolved.sort((a, b) => (a.fromPath + String(a.line).padStart(8, "0")).localeCompare(b.fromPath + String(b.line).padStart(8, "0")));
  return { graph, externals, unresolved };
}
