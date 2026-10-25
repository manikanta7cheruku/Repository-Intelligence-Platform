import type { AnalysisConfig } from "../config/config.js";
import { git } from "../git/history.js";
import { isSafeGitRef, withWorktree } from "../git/worktree.js";
import type { Report } from "../ir/types.js";
import { analyzeDirectory } from "../pipeline/snapshot.js";
import { DIMENSION_LABELS } from "../glossary/glossary.js";

export interface TrendPoint {
  commit: string;
  date: string;
  subject: string;
  codeLines: number;
  files: number;
  modules: number;
  edges: number;
  fileCycles: number;
  moduleCycles: number;
  externalPackages: number;
  highComplexityFunctions: number;
  duplicationRatio: number | null;
  findings: number;
  scores: Record<string, number | null>;
  status: string;
}

export interface TrendReport {
  ref: string;
  points: TrendPoint[];
  drift: {
    edgesAdded: number;
    edgesRemoved: number;
    modulesAdded: string[];
    modulesRemoved: string[];
    externalAdded: string[];
    externalRemoved: string[];
  } | null;
  insights: string[];
  limitations: string[];
}

const pointOf = (commit: string, date: string, subject: string, r: Report): TrendPoint => ({
  commit,
  date,
  subject,
  codeLines: r.metrics.totals.codeLines,
  files: r.repository.productionFiles,
  modules: r.graph.modules.length,
  edges: r.graph.edges.length,
  fileCycles: r.graph.cycles.filter((c) => c.scope === "file" && !c.typeOnly).length,
  moduleCycles: r.graph.cycles.filter((c) => c.scope === "module").length,
  externalPackages: r.externalDependencies.filter((x) => !x.builtin).length,
  highComplexityFunctions: r.metrics.complexityDistribution
    ? r.metrics.complexityDistribution.high + r.metrics.complexityDistribution.veryHigh
    : 0,
  duplicationRatio: r.metrics.duplication.ratio,
  findings: r.findings.length,
  scores: Object.fromEntries(r.scores.map((s) => [s.dimension, s.value])),
  status: r.status,
});

const edgeKeys = (r: Report): Set<string> => {
  const m = new Map(r.graph.nodes.map((n) => [n.id, n.path]));
  return new Set(r.graph.edges.map((e) => `${m.get(e.from)} -> ${m.get(e.to)}`));
};

/** Evenly spaced indexes including the first and last. */
export function sampleIndexes(total: number, points: number): number[] {
  if (total <= points) return Array.from({ length: total }, (_, i) => i);
  return [
    ...new Set(
      Array.from({ length: points }, (_, i) => Math.round((i * (total - 1)) / (points - 1))),
    ),
  ];
}

export interface TrendOptions {
  config: AnalysisConfig;
  ref?: string;
  points?: number;
  maxCommits?: number;
  rules?: { text: string; name: string } | null;
  onProgress?: (done: number, total: number, commit: string) => void;
  signal?: AbortSignal | undefined;
}

/** Analyzes evenly spaced commits on the first-parent history and reports how architecture and quality changed. */
export async function computeTrend(repoRoot: string, o: TrendOptions): Promise<TrendReport> {
  const ref = o.ref ?? "HEAD";
  if (!isSafeGitRef(ref)) throw new Error(`Unsafe or invalid ref: ${ref}`);
  const points = Math.min(Math.max(o.points ?? 6, 2), 15);
  const listing = (
    await git(
      ["rev-list", "--first-parent", "--reverse", `-n${o.maxCommits ?? 500}`, ref],
      repoRoot,
      o.signal,
      60_000,
    )
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (listing.length === 0) throw new Error("No commits found");
  const config: AnalysisConfig = {
    ...o.config,
    history: { ...o.config.history, enabled: false },
    security: { ...o.config.security, offline: true, osv: false, secrets: false, workflows: false },
  };
  const picks = sampleIndexes(listing.length, points).map((i) => listing[i] as string);
  const out: TrendPoint[] = [];
  let first: Report | null = null;
  let last: Report | null = null;
  let done = 0;
  for (const commit of picks) {
    const meta = (
      await git(["show", "-s", "--format=%aI%x1f%s", commit], repoRoot, o.signal, 30_000)
    )
      .trim()
      .split("\x1f");
    const report = await withWorktree(
      repoRoot,
      commit,
      (dir) =>
        analyzeDirectory(dir, commit.slice(0, 7), {
          config,
          rules: o.rules ?? null,
          ...(o.signal ? { signal: o.signal } : {}),
        }),
      o.signal,
    );
    out.push(
      pointOf(
        commit.slice(0, 10),
        (meta[0] ?? "").slice(0, 10),
        (meta[1] ?? "").slice(0, 80),
        report,
      ),
    );
    if (first === null) first = report;
    last = report;
    o.onProgress?.(++done, picks.length, commit.slice(0, 7));
  }
  let drift: TrendReport["drift"] = null;
  const insights: string[] = [];
  if (first && last && out.length >= 2) {
    const a = edgeKeys(first);
    const b = edgeKeys(last);
    const ma = new Set(first.graph.modules.map((m) => m.path));
    const mb = new Set(last.graph.modules.map((m) => m.path));
    const xa = new Set(first.externalDependencies.filter((x) => !x.builtin).map((x) => x.name));
    const xb = new Set(last.externalDependencies.filter((x) => !x.builtin).map((x) => x.name));
    drift = {
      edgesAdded: [...b].filter((e) => !a.has(e)).length,
      edgesRemoved: [...a].filter((e) => !b.has(e)).length,
      modulesAdded: [...mb].filter((m) => !ma.has(m)).sort(),
      modulesRemoved: [...ma].filter((m) => !mb.has(m)).sort(),
      externalAdded: [...xb].filter((x) => !xa.has(x)).sort(),
      externalRemoved: [...xa].filter((x) => !xb.has(x)).sort(),
    };
    const p0 = out[0] as TrendPoint;
    const p1 = out[out.length - 1] as TrendPoint;
    if (p0.codeLines > 0)
      insights.push(
        `Code size changed from ${p0.codeLines} to ${p1.codeLines} lines (${p1.codeLines >= p0.codeLines ? "+" : ""}${Math.round(((p1.codeLines - p0.codeLines) / p0.codeLines) * 100)} percent).`,
      );
    if (p0.files > 0 && p1.files > 0) {
      const d0 = p0.edges / p0.files;
      const d1 = p1.edges / p1.files;
      insights.push(
        `Dependencies per file changed from ${d0.toFixed(2)} to ${d1.toFixed(2)}${d1 > d0 * 1.15 ? ", so files are becoming more interconnected than they were" : d1 < d0 * 0.85 ? ", so files are becoming less interconnected" : ", which is roughly stable"}.`,
      );
    }
    if (p1.fileCycles + p1.moduleCycles !== p0.fileCycles + p0.moduleCycles)
      insights.push(
        `Circular dependencies changed from ${p0.fileCycles + p0.moduleCycles} to ${p1.fileCycles + p1.moduleCycles}.`,
      );
    if (p1.externalPackages !== p0.externalPackages)
      insights.push(
        `Third-party packages imported changed from ${p0.externalPackages} to ${p1.externalPackages}.`,
      );
    for (const dim of ["architecture", "maintainability"]) {
      const s0 = p0.scores[dim];
      const s1 = p1.scores[dim];
      if (s0 !== null && s0 !== undefined && s1 !== null && s1 !== undefined && s0 !== s1)
        insights.push(`${DIMENSION_LABELS[dim]} score moved from ${s0} to ${s1}.`);
    }
    if (insights.length === 0)
      insights.push("No notable structural change between the first and last sampled commits.");
  }
  return {
    ref,
    points: out,
    drift,
    insights,
    limitations: [
      `Only ${out.length} evenly spaced commits on the first-parent history were analyzed, so changes between samples are not visible.`,
      "Each snapshot is analyzed offline without Git history, vulnerability lookups, secret scans or workflow checks, so only structure and quality metrics are compared.",
      "Squash merges and rebases make commit-level history coarser than development actually was.",
    ],
  };
}

const BARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";
export function sparkline(values: (number | null)[]): string {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return values
    .map(
      (v) =>
        (v === null
          ? "."
          : BARS[
              max === min ? 3 : Math.round(((v - min) / (max - min)) * (BARS.length - 1))
            ]) as string,
    )
    .join("");
}

const safe = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|");

export function trendToMarkdown(t: TrendReport): string {
  const out = [
    `# RepoLens trend: ${safe(t.ref)}`,
    "",
    ...t.insights.map((i) => `- ${safe(i)}`),
    "",
  ];
  out.push(
    "| Commit | Date | Code lines | Modules | Edges | Cycles | Third-party | Architecture | Maintainability | Subject |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const p of t.points)
    out.push(
      `| ${p.commit} | ${p.date} | ${p.codeLines} | ${p.modules} | ${p.edges} | ${p.fileCycles + p.moduleCycles} | ${p.externalPackages} | ${p.scores.architecture ?? "n/a"} | ${p.scores.maintainability ?? "n/a"} | ${safe(p.subject)} |`,
    );
  out.push(
    "",
    "Trend lines (oldest to newest):",
    "",
    `- Code lines: ${sparkline(t.points.map((p) => p.codeLines))}`,
    `- Dependency edges: ${sparkline(t.points.map((p) => p.edges))}`,
    `- Architecture score: ${sparkline(t.points.map((p) => p.scores.architecture ?? null))}`,
    `- Maintainability score: ${sparkline(t.points.map((p) => p.scores.maintainability ?? null))}`,
    "",
  );
  if (t.drift)
    out.push(
      "## Drift between the first and last sample",
      "",
      `- Dependency edges: ${t.drift.edgesAdded} added, ${t.drift.edgesRemoved} removed.`,
      `- Modules added: ${t.drift.modulesAdded.join(", ") || "none"}. Removed: ${t.drift.modulesRemoved.join(", ") || "none"}.`,
      `- Third-party packages added: ${t.drift.externalAdded.slice(0, 15).join(", ") || "none"}. Removed: ${t.drift.externalRemoved.slice(0, 15).join(", ") || "none"}.`,
      "",
    );
  out.push("## Limitations", "", ...t.limitations.map((l) => `- ${l}`), "");
  return out.join("\n");
}
