import type { Report } from "../ir/types.js";

export interface ReportDiff {
  from: { commit: string | null; hash: string };
  to: { commit: string | null; hash: string };
  findings: { added: string[]; resolved: string[]; unchanged: number };
  edges: { added: [string, string][]; removed: [string, string][] };
  modules: { added: string[]; removed: string[] };
  externalDependencies: { added: string[]; removed: string[] };
  scores: { dimension: string; from: number | null; to: number | null; delta: number | null }[];
  summary: string[];
}

const pathEdges = (r: Report): Set<string> => {
  const idToPath = new Map(r.graph.nodes.map((n) => [n.id, n.path]));
  return new Set(r.graph.edges.map((e) => `${idToPath.get(e.from)}\u0000${idToPath.get(e.to)}`));
};

/** Compares two reports: architecture drift, finding changes and score deltas. Missing values stay null. */
export function diffReports(a: Report, b: Report): ReportDiff {
  const fa = new Set(a.findings.map((f) => f.id));
  const fb = new Set(b.findings.map((f) => f.id));
  const ea = pathEdges(a);
  const eb = pathEdges(b);
  const split = (k: string): [string, string] => k.split("\u0000") as [string, string];
  const ma = new Set(a.graph.modules.map((m) => m.path));
  const mb = new Set(b.graph.modules.map((m) => m.path));
  const xa = new Set(a.externalDependencies.filter((x) => !x.builtin).map((x) => x.name));
  const xb = new Set(b.externalDependencies.filter((x) => !x.builtin).map((x) => x.name));
  const sa = new Map(a.scores.map((s) => [s.dimension, s.value]));
  const diff = <T>(x: Set<T>, y: Set<T>): T[] => [...y].filter((v) => !x.has(v)).sort() as T[];
  const result: ReportDiff = {
    from: { commit: a.repository.commitSha, hash: a.reproducibility.contentHash },
    to: { commit: b.repository.commitSha, hash: b.reproducibility.contentHash },
    findings: {
      added: diff(fa, fb),
      resolved: diff(fb, fa),
      unchanged: [...fa].filter((id) => fb.has(id)).length,
    },
    edges: { added: diff(ea, eb).map(split), removed: diff(eb, ea).map(split) },
    modules: { added: diff(ma, mb), removed: diff(mb, ma) },
    externalDependencies: { added: diff(xa, xb), removed: diff(xb, xa) },
    scores: b.scores.map((s) => {
      const from = sa.get(s.dimension) ?? null;
      return {
        dimension: s.dimension,
        from,
        to: s.value,
        delta: from === null || s.value === null ? null : s.value - from,
      };
    }),
    summary: [],
  };
  result.summary = [
    `${result.findings.added.length} new findings, ${result.findings.resolved.length} resolved, ${result.findings.unchanged} unchanged.`,
    `${result.edges.added.length} dependency edges added, ${result.edges.removed.length} removed.`,
    `${result.modules.added.length} modules added, ${result.modules.removed.length} removed.`,
    ...result.scores
      .filter((s) => s.delta !== null && s.delta !== 0)
      .map(
        (s) =>
          `${s.dimension}: ${s.from} to ${s.to} (${(s.delta as number) > 0 ? "+" : ""}${s.delta}).`,
      ),
  ];
  return result;
}

export function diffToMarkdown(d: ReportDiff): string {
  const list = (title: string, items: string[]) =>
    items.length ? [`### ${title}`, "", ...items.map((i) => `- ${i}`), ""] : [];
  return [
    "# RepoLens comparison",
    "",
    `From ${d.from.commit ?? "unknown commit"} to ${d.to.commit ?? "unknown commit"}.`,
    "",
    ...d.summary.map((s) => `- ${s}`),
    "",
    ...list("New findings", d.findings.added),
    ...list("Resolved findings", d.findings.resolved),
    ...list(
      "Added dependency edges",
      d.edges.added.map(([x, y]) => `${x} -> ${y}`),
    ),
    ...list(
      "Removed dependency edges",
      d.edges.removed.map(([x, y]) => `${x} -> ${y}`),
    ),
    ...list("Added modules", d.modules.added),
    ...list("Removed modules", d.modules.removed),
    ...list("New external packages", d.externalDependencies.added),
    ...list("Dropped external packages", d.externalDependencies.removed),
    "### Scores",
    "",
    "| Dimension | From | To | Change |",
    "|---|---|---|---|",
    ...d.scores.map(
      (s) => `| ${s.dimension} | ${s.from ?? "n/a"} | ${s.to ?? "n/a"} | ${s.delta ?? "n/a"} |`,
    ),
    "",
  ].join("\n");
}
