import type { BlastRadiusEntry, CycleRecord, Finding, Report, RiskFile } from "../ir/types.js";
import { SEVERITY_RANK } from "../findings/make.js";
import { DIMENSION_LABELS } from "../glossary/glossary.js";

export type PrVerdict = "regressed" | "improved" | "unchanged";

export interface PrAssessment {
  verdict: PrVerdict;
  reasons: string[];
  base: { commit: string | null; contentHash: string };
  head: { commit: string | null; contentHash: string };
  configMatches: boolean;
  changedFiles: string[] | null;
  newFindings: Finding[];
  resolvedFindings: string[];
  newRuleViolations: Finding[];
  newCycles: CycleRecord[];
  resolvedCycles: CycleRecord[];
  newEdges: [string, string][];
  newCrossModuleEdges: [string, string][];
  newExternalPackages: string[];
  newVulnerabilities: Finding[];
  complexityIncreases: { path: string; name: string; from: number | null; to: number }[];
  scoreDeltas: { dimension: string; from: number | null; to: number | null; delta: number | null }[];
  blastRadiusOfChanges: BlastRadiusEntry[];
  riskyChangedFiles: RiskFile[];
  summary: string[];
}

const cycleKey = (c: CycleRecord): string => `${c.scope}:${[...c.members].sort().join("|")}`;

function edgeSet(r: Report): Map<string, [string, string]> {
  const idToPath = new Map(r.graph.nodes.map((n) => [n.id, n.path]));
  return new Map(r.graph.edges.map((e) => [`${idToPath.get(e.from)}\u0000${idToPath.get(e.to)}`, [idToPath.get(e.from) as string, idToPath.get(e.to) as string] as [string, string]]));
}

/**
 * Compares a base analysis with a head analysis and decides whether architecture regressed.
 * Both reports should come from the same configuration, rules and offline mode, otherwise differences may not be caused by the change.
 */
export function assessPullRequest(base: Report, head: Report, opts: { changedFiles?: string[] | null } = {}): PrAssessment {
  const baseIds = new Set(base.findings.map((f) => f.id));
  const headIds = new Set(head.findings.map((f) => f.id));
  const newFindings = head.findings.filter((f) => !baseIds.has(f.id));
  const resolvedFindings = base.findings.filter((f) => !headIds.has(f.id)).map((f) => f.id);
  const newRuleViolations = newFindings.filter((f) => f.ruleId.startsWith("rule."));
  const newVulnerabilities = newFindings.filter((f) => f.ruleId === "security.osv");

  const baseCycles = new Set(base.graph.cycles.map(cycleKey));
  const headCycles = new Set(head.graph.cycles.map(cycleKey));
  const newCycles = head.graph.cycles.filter((c) => !baseCycles.has(cycleKey(c)));
  const resolvedCycles = base.graph.cycles.filter((c) => !headCycles.has(cycleKey(c)));

  const be = edgeSet(base);
  const he = edgeSet(head);
  const newEdges = [...he.entries()].filter(([k]) => !be.has(k)).map(([, v]) => v).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  const modOf = (r: Report) => {
    const m = new Map(r.graph.modules.map((x) => [x.id, x.path]));
    return new Map(r.graph.nodes.map((n) => [n.path, m.get(n.moduleId) ?? n.moduleId]));
  };
  const hm = modOf(head);
  const newCrossModuleEdges = newEdges.filter(([a, b]) => hm.get(a) !== hm.get(b));
  const baseExt = new Set(base.externalDependencies.filter((x) => !x.builtin).map((x) => x.name));
  const newExternalPackages = head.externalDependencies.filter((x) => !x.builtin && !baseExt.has(x.name)).map((x) => x.name).sort();

  const baseFns = new Map(base.metrics.topFunctions.map((f) => [`${f.path}::${f.name}`, f.complexity]));
  const complexityIncreases = head.metrics.topFunctions
    .filter((f) => f.complexity > 10)
    .map((f) => ({ path: f.path, name: f.name, from: baseFns.get(`${f.path}::${f.name}`) ?? null, to: f.complexity }))
    .filter((f) => f.from === null || f.to - f.from >= 3)
    .sort((a, b) => b.to - a.to);

  const bs = new Map(base.scores.map((s) => [s.dimension, s.value]));
  const scoreDeltas = head.scores.map((s) => {
    const from = bs.get(s.dimension) ?? null;
    return { dimension: s.dimension, from, to: s.value, delta: from === null || s.value === null ? null : s.value - from };
  });

  const changed = opts.changedFiles ?? null;
  const changedSet = new Set(changed ?? []);
  const blast = changed ? head.blastRadius.filter((b) => changedSet.has(b.path)) : [];
  const riskyChangedFiles = changed ? head.risk.files.filter((f) => changedSet.has(f.path) && f.risk >= 50) : [];

  const reasons: string[] = [];
  if (newRuleViolations.length > 0) reasons.push(`${newRuleViolations.length} new architecture rule violation${newRuleViolations.length === 1 ? "" : "s"}.`);
  const newRuntimeCycles = newCycles.filter((c) => !c.typeOnly);
  if (newRuntimeCycles.length > 0) reasons.push(`${newRuntimeCycles.length} new circular dependenc${newRuntimeCycles.length === 1 ? "y" : "ies"}.`);
  const newSerious = newFindings.filter((f) => f.category !== "analysis" && SEVERITY_RANK[f.severity] <= SEVERITY_RANK.high && !f.ruleId.startsWith("rule."));
  if (newSerious.length > 0) reasons.push(`${newSerious.length} new critical or high finding${newSerious.length === 1 ? "" : "s"}.`);
  for (const d of scoreDeltas) if (["architecture", "maintainability", "security-hygiene"].includes(d.dimension) && d.delta !== null && d.delta <= -3) reasons.push(`${DIMENSION_LABELS[d.dimension]} score dropped by ${-d.delta} points (${d.from} to ${d.to}).`);
  let verdict: PrVerdict = reasons.length > 0 ? "regressed" : "unchanged";
  if (verdict === "unchanged") {
    const gains = scoreDeltas.filter((d) => d.delta !== null && d.delta >= 3);
    if (resolvedFindings.length > newFindings.length || resolvedCycles.length > 0 || gains.length > 0) {
      verdict = "improved";
      if (resolvedFindings.length > newFindings.length) reasons.push(`${resolvedFindings.length} findings resolved versus ${newFindings.length} added.`);
      if (resolvedCycles.length > 0) reasons.push(`${resolvedCycles.length} circular dependenc${resolvedCycles.length === 1 ? "y" : "ies"} removed.`);
      for (const g of gains) reasons.push(`${DIMENSION_LABELS[g.dimension]} score rose by ${g.delta} points.`);
    } else reasons.push("No new rule violations, cycles or serious findings, and no meaningful score change.");
  }

  const summary = [
    `${newFindings.length} new and ${resolvedFindings.length} resolved findings.`,
    `${newEdges.length} new dependency edges (${newCrossModuleEdges.length} between modules), ${newCycles.length} new cycles.`,
    `${newExternalPackages.length} new third-party packages${newExternalPackages.length ? `: ${newExternalPackages.slice(0, 5).join(", ")}` : ""}.`,
  ];
  return {
    verdict, reasons, base: { commit: base.repository.commitSha, contentHash: base.reproducibility.contentHash }, head: { commit: head.repository.commitSha, contentHash: head.reproducibility.contentHash },
    configMatches: base.methodology.configHash === head.methodology.configHash, changedFiles: changed, newFindings, resolvedFindings, newRuleViolations, newCycles, resolvedCycles, newEdges, newCrossModuleEdges,
    newExternalPackages, newVulnerabilities, complexityIncreases, scoreDeltas, blastRadiusOfChanges: blast, riskyChangedFiles, summary,
  };
}

const safe = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|");
const VERDICT_TEXT: Record<PrVerdict, string> = { regressed: "Architecture regressed", improved: "Architecture improved", unchanged: "Architecture unchanged" };

/** Markdown for a pull request comment. Short, with the decision first. */
export function prToMarkdown(a: PrAssessment, opts: { maxItems?: number } = {}): string {
  const n = opts.maxItems ?? 8;
  const out: string[] = [`## RepoLens pull request check: ${VERDICT_TEXT[a.verdict]}`, ""];
  out.push(...a.reasons.map((r) => `- ${safe(r)}`), "");
  if (!a.configMatches) out.push("> The base and head analyses used different configurations, so some differences may not come from this change.", "");
  out.push("| Signal | Result |", "|---|---|", ...a.summary.map((s, i) => `| ${["Findings", "Dependencies", "Third-party packages"][i]} | ${safe(s)} |`));
  out.push(...a.scoreDeltas.filter((d) => d.delta !== null && d.delta !== 0).map((d) => `| ${DIMENSION_LABELS[d.dimension]} score | ${d.from} to ${d.to} (${(d.delta as number) > 0 ? "+" : ""}${d.delta}) |`), "");
  if (a.newRuleViolations.length > 0) out.push("### New rule violations", ...a.newRuleViolations.slice(0, n).map((f) => `- ${safe(f.title)} (${safe(f.locations[0]?.path ?? "")}${f.locations[0]?.startLine ? `:${f.locations[0].startLine}` : ""})`), "");
  if (a.newCycles.length > 0) out.push("### New circular dependencies", ...a.newCycles.slice(0, n).map((c) => `- ${c.scope}: ${safe(c.members.slice(0, 6).join(", "))}${c.typeOnly ? " (type-only)" : ""}`), "");
  const other = a.newFindings.filter((f) => !f.ruleId.startsWith("rule.")).sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
  if (other.length > 0) out.push("### Other new findings", ...other.slice(0, n).map((f) => `- ${f.severity}: ${safe(f.title)}`), "");
  if (a.complexityIncreases.length > 0) out.push("### Complexity increases", ...a.complexityIncreases.slice(0, n).map((c) => `- ${safe(c.name)} in ${safe(c.path)}: ${c.from === null ? "new, " : `${c.from} to `}${c.to}`), "");
  if (a.changedFiles) {
    out.push(`### Blast radius of this change (${a.changedFiles.length} files changed)`);
    out.push(a.blastRadiusOfChanges.length > 0 ? a.blastRadiusOfChanges.slice(0, n).map((b) => `- ${safe(b.path)}: ${b.transitiveDependents} dependent files across ${b.modulesAffected.length} modules${b.entrypointsAffected.length ? `, reaches ${b.entrypointsAffected.length} entrypoint(s)` : ""}`).join("\n") : "No changed file has dependents in the analyzed graph (or the files are not production source).");
    if (a.riskyChangedFiles.length > 0) out.push("", "Changed files with a high risk index:", ...a.riskyChangedFiles.slice(0, n).map((f) => `- ${safe(f.path)}: ${f.risk} (${safe(f.drivers.join("; ") || "blend of signals")})`));
    out.push("");
  }
  out.push("_Static analysis of the repository snapshot. Dynamic behavior is not covered. Generated by RepoLens._", "");
  return out.join("\n");
}
