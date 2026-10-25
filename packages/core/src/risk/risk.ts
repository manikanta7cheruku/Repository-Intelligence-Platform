import { buildReverseIndex, impactOf } from "../graph/impact.js";
import type {
  Confidence,
  FileMetrics,
  GraphModel,
  RiskFactor,
  RiskFile,
  RiskSummary,
} from "../ir/types.js";

export const RISK_METHOD =
  "Risk index = weighted mean of available factors: complexity percentile (0.30), dependents percentile (0.25), change frequency percentile (0.25), lack of test linkage or coverage (0.20). At least 2 factors are required. It ranks files by how costly a change could be. It does not predict defects.";

const WEIGHTS = { complexity: 0.3, dependents: 0.25, churn: 0.25, tests: 0.2 } as const;

export interface RiskInputs {
  graph: GraphModel;
  fileMetrics: FileMetrics[];
  entrypoints: string[];
  /** Commits and churn per file when history is available. */
  fileStats: Map<string, { commits: number; churn: number }> | null;
  /** Production files directly imported by at least one test file. */
  testDirect: Set<string>;
  hasTests: boolean;
  /** Line coverage 0..1 per file, when a report was ingested. */
  coverage: Map<string, number> | null;
  limit?: number;
}

/** Share of values strictly below v. Ties at the bottom score 0, so zeros do not look average. */
function rank(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] as number) < v) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length === 0 ? 0 : lo / sorted.length;
}

export function computeRisk(i: RiskInputs): RiskSummary {
  const nodes = i.graph.nodes;
  if (nodes.length < 5)
    return {
      assessed: false,
      reason: "Fewer than 5 analyzed production files, so percentiles would not be meaningful",
      method: RISK_METHOD,
      files: [],
    };
  const idx = buildReverseIndex(i.graph, i.entrypoints);
  const modulePath = new Map(i.graph.modules.map((m) => [m.id, m.path]));
  const complexity = new Map(
    i.fileMetrics
      .filter((m) => m.maxComplexity !== null)
      .map((m) => [m.path, m.maxComplexity as number]),
  );
  const useTransitive = nodes.length <= 3000;
  const dependents = new Map<string, number>();
  for (const n of nodes)
    dependents.set(
      n.path,
      useTransitive ? (impactOf(idx, n.path)?.transitiveDependents ?? 0) : n.fanIn,
    );

  // Files reachable (forward) from files that tests import directly: loaded by tests in principle.
  const fwd = new Map<string, string[]>();
  for (const e of i.graph.edges) (fwd.get(e.from) ?? fwd.set(e.from, []).get(e.from))?.push(e.to);
  const testReach = new Set<string>();
  const stack = [...i.testDirect]
    .map((p) => idx.idByPath.get(p))
    .filter((x): x is string => x !== undefined);
  for (const s of stack) testReach.add(s);
  while (stack.length > 0)
    for (const w of fwd.get(stack.pop() as string) ?? [])
      if (!testReach.has(w)) {
        testReach.add(w);
        stack.push(w);
      }

  const sortedComplexity = [...complexity.values()].sort((a, b) => a - b);
  const sortedDependents = [...dependents.values()].sort((a, b) => a - b);
  const sortedCommits = i.fileStats
    ? [...nodes.map((n) => i.fileStats?.get(n.path)?.commits ?? 0)].sort((a, b) => a - b)
    : [];
  const testsKnown = i.hasTests || (i.coverage !== null && i.coverage.size > 0);

  const out: RiskFile[] = [];
  for (const n of nodes) {
    const factors: RiskFactor[] = [];
    const scored: { name: keyof typeof WEIGHTS; s: number }[] = [];
    const cx = complexity.get(n.path);
    if (cx !== undefined) {
      const p = rank(sortedComplexity, cx);
      factors.push({
        name: "complexity",
        value: cx,
        percentile: Math.round(p * 1000) / 1000,
        note: `highest function complexity ${cx}`,
      });
      scored.push({ name: "complexity", s: p });
    } else
      factors.push({
        name: "complexity",
        value: null,
        percentile: null,
        note: "No complexity measurement for this file",
      });
    const dep = dependents.get(n.path) ?? 0;
    const dp = rank(sortedDependents, dep);
    factors.push({
      name: "dependents",
      value: dep,
      percentile: Math.round(dp * 1000) / 1000,
      note: `${dep} ${useTransitive ? "files depend on it directly or indirectly" : "files import it directly"}`,
    });
    scored.push({ name: "dependents", s: dp });
    if (i.fileStats) {
      const c = i.fileStats.get(n.path)?.commits ?? 0;
      const p = rank(sortedCommits, c);
      factors.push({
        name: "churn",
        value: c,
        percentile: Math.round(p * 1000) / 1000,
        note: `changed in ${c} commits`,
      });
      scored.push({ name: "churn", s: p });
    } else
      factors.push({
        name: "churn",
        value: null,
        percentile: null,
        note: "No Git history available",
      });
    if (testsKnown) {
      const cov = i.coverage?.get(n.path);
      let s: number;
      let note: string;
      if (cov !== undefined) {
        s = 1 - cov;
        note = `${Math.round(cov * 100)} percent of lines covered by tests`;
      } else if (i.testDirect.has(n.path)) {
        s = 0;
        note = "imported directly by a test file";
      } else if (testReach.has(n.id)) {
        s = 0.5;
        note = "only reached indirectly from test files";
      } else {
        s = 1;
        note = "no test file imports it, directly or indirectly";
      }
      factors.push({ name: "tests", value: Math.round(s * 100) / 100, percentile: null, note });
      scored.push({ name: "tests", s });
    } else
      factors.push({
        name: "tests",
        value: null,
        percentile: null,
        note: "No test files or coverage report to judge test linkage",
      });

    if (scored.length < 2) continue;
    const wsum = scored.reduce((a, f) => a + WEIGHTS[f.name], 0);
    const risk = Math.round((100 * scored.reduce((a, f) => a + WEIGHTS[f.name] * f.s, 0)) / wsum);
    const contributions = scored
      .map((f) => ({ ...f, c: (WEIGHTS[f.name] * f.s) / wsum }))
      .sort((a, b) => b.c - a.c);
    const drivers = contributions
      .filter((c) => c.s >= 0.6)
      .slice(0, 3)
      .map((c) => {
        const f = factors.find((x) => x.name === c.name) as RiskFactor;
        return c.name === "complexity"
          ? `high complexity (${f.note})`
          : c.name === "dependents"
            ? f.note
            : c.name === "churn"
              ? `frequently changed (${f.note})`
              : `weak test linkage (${f.note})`;
      });
    const confidence: Confidence =
      scored.length >= 4 ? "high" : scored.length === 3 ? "medium" : "low";
    out.push({
      path: n.path,
      moduleId: n.moduleId ? (modulePath.has(n.moduleId) ? n.moduleId : null) : null,
      risk,
      confidence,
      factors,
      drivers,
      explanation:
        drivers.length > 0
          ? `Ranked high because of: ${drivers.join("; ")}.`
          : "No single factor stands out. The score is a blend of moderate signals.",
    });
  }
  if (out.length === 0)
    return {
      assessed: false,
      reason: "Fewer than 2 risk factors were available for every file",
      method: RISK_METHOD,
      files: [],
    };
  out.sort((a, b) => b.risk - a.risk || a.path.localeCompare(b.path));
  return { assessed: true, reason: null, method: RISK_METHOD, files: out.slice(0, i.limit ?? 15) };
}
