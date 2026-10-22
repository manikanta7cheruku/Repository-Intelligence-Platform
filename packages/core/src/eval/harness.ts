import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveConfig } from "../config/config.js";
import { openLocalWorkspace } from "../acquire/local.js";
import { analyze } from "../pipeline/analyze.js";
import type { Report } from "../ir/types.js";

export interface Expected {
  description: string;
  edges: [string, string][];
  externals: string[];
  unresolved: [string, string][];
  fileCycles: string[][];
  moduleCycles: string[][];
  typeOnlyFileCycles: string[][];
  ruleViolations: Record<string, number>;
  entrypoints: string[];
  unsupportedLanguages: string[];
  notAssessed?: string[];
  syntaxErrorFiles?: string[];
  workflowFindings?: Record<string, number>;
  dynamicUnresolvedAtLeast?: number;
}

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
}

export interface FixtureResult {
  name: string;
  counts: Record<"edges" | "externals" | "unresolved" | "fileCycles" | "moduleCycles", Counts>;
  failures: string[];
  report: Report;
}

const sorted = (a: string[]): string[] => [...a].sort();

function compare(expected: string[], actual: string[]): Counts {
  const e = new Set(expected);
  const a = new Set(actual);
  return { tp: [...a].filter((x) => e.has(x)).length, fp: [...a].filter((x) => !e.has(x)).length, fn: [...e].filter((x) => !a.has(x)).length };
}

export function actualSets(r: Report) {
  const idToPath = new Map(r.graph.nodes.map((n) => [n.id, n.path]));
  return {
    edges: r.graph.edges.map((e) => `${idToPath.get(e.from)}>${idToPath.get(e.to)}`),
    externals: r.externalDependencies.map((x) => x.name),
    unresolved: r.unresolvedImports.map((u) => `${u.fromPath}|${u.specifier}`),
    fileCycles: r.graph.cycles.filter((c) => c.scope === "file").map((c) => c.members.join(",")),
    moduleCycles: r.graph.cycles.filter((c) => c.scope === "module").map((c) => c.members.join(",")),
  };
}

export async function evaluateFixture(dir: string, name: string): Promise<FixtureResult> {
  const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Expected;
  const config = resolveConfig({ security: { offline: true }, history: { enabled: false } });
  const ws = openLocalWorkspace(dir, config);
  const rulesPath = ["repolens.rules.yaml", "repolens.rules.json"].map((n) => join(dir, n)).find((p) => existsSync(p));
  const report = await analyze({
    config, workspace: ws, source: { type: "local", location: name, ref: null, name },
    historyRoot: null, rules: rulesPath ? { text: readFileSync(rulesPath, "utf8"), name: rulesPath.split("/").pop() as string } : null,
  });
  const act = actualSets(report);
  const counts = {
    edges: compare(expected.edges.map(([a, b]) => `${a}>${b}`), act.edges),
    externals: compare(expected.externals, act.externals),
    unresolved: compare(expected.unresolved.map(([a, b]) => `${a}|${b}`), act.unresolved),
    fileCycles: compare(expected.fileCycles.map((c) => sorted(c).join(",")), act.fileCycles),
    moduleCycles: compare(expected.moduleCycles.map((c) => sorted(c).join(",")), act.moduleCycles),
  };
  const failures: string[] = [];
  const check = (label: string, ok: boolean, detail: string) => {
    if (!ok) failures.push(`${label}: ${detail}`);
  };
  const ruleCounts: Record<string, number> = {};
  for (const f of report.findings) if (f.ruleId.startsWith("rule.")) ruleCounts[f.ruleId] = (ruleCounts[f.ruleId] ?? 0) + 1;
  check("ruleViolations", JSON.stringify(ruleCounts, Object.keys(ruleCounts).sort()) === JSON.stringify(expected.ruleViolations, Object.keys(expected.ruleViolations).sort()), `expected ${JSON.stringify(expected.ruleViolations)}, got ${JSON.stringify(ruleCounts)}`);
  const unsupported = report.scope.languages.filter((l) => l.supportLevel === 1).map((l) => l.language);
  check("unsupportedLanguages", JSON.stringify(sorted(unsupported)) === JSON.stringify(sorted(expected.unsupportedLanguages)), `expected ${expected.unsupportedLanguages}, got ${unsupported}`);
  check("entrypoints", JSON.stringify(sorted(report.detection.entrypoints.map((e) => e.path))) === JSON.stringify(sorted(expected.entrypoints)), `expected ${expected.entrypoints}, got ${report.detection.entrypoints.map((e) => e.path)}`);
  const typeOnly = report.graph.cycles.filter((c) => c.scope === "file" && c.typeOnly).map((c) => c.members.join(","));
  check("typeOnlyFileCycles", JSON.stringify(typeOnly) === JSON.stringify(expected.typeOnlyFileCycles.map((c) => sorted(c).join(","))), `expected ${JSON.stringify(expected.typeOnlyFileCycles)}, got ${typeOnly}`);
  if (expected.notAssessed) {
    const na = report.scores.filter((s) => s.state === "not-assessed").map((s) => s.dimension);
    for (const d of expected.notAssessed) check("notAssessed", na.includes(d as never), `${d} should be not-assessed, got ${na}`);
  }
  if (expected.syntaxErrorFiles) {
    const got = report.findings.filter((f) => f.ruleId === "analysis.parse-errors").flatMap((f) => f.locations.map((l) => l.path));
    check("syntaxErrorFiles", JSON.stringify(sorted(got)) === JSON.stringify(sorted(expected.syntaxErrorFiles)), `expected ${expected.syntaxErrorFiles}, got ${got}`);
  }
  if (expected.workflowFindings) {
    const wf: Record<string, number> = {};
    for (const f of report.findings) if (f.ruleId.startsWith("security.workflow.")) wf[f.ruleId] = (wf[f.ruleId] ?? 0) + 1;
    check("workflowFindings", JSON.stringify(wf, Object.keys(wf).sort()) === JSON.stringify(expected.workflowFindings, Object.keys(expected.workflowFindings).sort()), `expected ${JSON.stringify(expected.workflowFindings)}, got ${JSON.stringify(wf)}`);
  }
  if (expected.dynamicUnresolvedAtLeast) check("dynamicUnresolved", report.limitations.some((l) => /dynamic import or require call/.test(l)), "limitation about unresolved dynamic imports missing");
  return { name, counts, failures, report };
}

export async function evaluateAll(fixturesDir: string): Promise<FixtureResult[]> {
  const names = readdirSync(fixturesDir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, "expected.json"))).map((d) => d.name).sort();
  const out: FixtureResult[] = [];
  for (const n of names) out.push(await evaluateFixture(join(fixturesDir, n), n));
  return out;
}

export function aggregate(results: FixtureResult[]): Record<string, Counts & { precision: number | null; recall: number | null }> {
  const keys = ["edges", "externals", "unresolved", "fileCycles", "moduleCycles"] as const;
  const out: Record<string, Counts & { precision: number | null; recall: number | null }> = {};
  for (const k of keys) {
    const c = results.reduce((s, r) => ({ tp: s.tp + r.counts[k].tp, fp: s.fp + r.counts[k].fp, fn: s.fn + r.counts[k].fn }), { tp: 0, fp: 0, fn: 0 });
    out[k] = { ...c, precision: c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp), recall: c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn) };
  }
  return out;
}

export function resultsMarkdown(results: FixtureResult[], meta: { date: string; node: string; typescript: string }): string {
  const agg = aggregate(results);
  const f = (v: number | null) => (v === null ? "n/a" : v.toFixed(3));
  const lines = [
    "# Phase 1 accuracy results (fixtures)", "",
    `Run date: ${meta.date}. Node ${meta.node}. TypeScript ${meta.typescript}.`, "",
    "Dataset: the hand-built fixtures in `fixtures/`. Ground truth was written by hand from the fixture source. The fixtures are small and written by the author of the tool, so these numbers show that the mechanisms are correct on known cases. They are not an estimate of accuracy on arbitrary real repositories.", "",
    "## Aggregate (micro-averaged over all fixtures)", "", "| Category | True positives | False positives | False negatives | Precision | Recall |", "|---|---|---|---|---|---|",
    ...Object.entries(agg).map(([k, v]) => `| ${k} | ${v.tp} | ${v.fp} | ${v.fn} | ${f(v.precision)} | ${f(v.recall)} |`), "",
    "n/a means the category had no expected or no reported items.", "",
    "## Per fixture", "", "| Fixture | Edges TP/FP/FN | Externals TP/FP/FN | Unresolved TP/FP/FN | Cycles (file) | Cycles (module) | Exact checks |", "|---|---|---|---|---|---|---|",
    ...results.map((r) => { const t = (c: Counts) => `${c.tp}/${c.fp}/${c.fn}`; return `| ${r.name} | ${t(r.counts.edges)} | ${t(r.counts.externals)} | ${t(r.counts.unresolved)} | ${t(r.counts.fileCycles)} | ${t(r.counts.moduleCycles)} | ${r.failures.length === 0 ? "pass" : `FAIL (${r.failures.length})`} |`; }), "",
  ];
  const failed = results.filter((r) => r.failures.length > 0);
  if (failed.length > 0) lines.push("## Failures", "", ...failed.flatMap((r) => r.failures.map((x) => `- ${r.name}: ${x}`)), "");
  lines.push("## Limitations of this evaluation", "", "- Author-built fixtures can share the author's blind spots.", "- Fixtures contain no generated code, no unusual build tooling, and no very large graphs.", "- Real repository benchmarks (time, memory, coverage) are recorded separately, see docs/evaluation/results.", "");
  return lines.join("\n");
}
