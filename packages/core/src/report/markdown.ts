import type { Finding, Report, ScoreRecord } from "../ir/types.js";

/** Neutralizes HTML in untrusted text so Markdown viewers cannot render injected markup. */
const safe = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (v: string | number | null | undefined): string => safe(v === null || v === undefined || v === "" ? "n/a" : String(v)).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const pct = (v: number | null): string => (v === null ? "n/a" : `${Math.round(v * 1000) / 10}%`);
const DIM_LABEL: Record<ScoreRecord["dimension"], string> = {
  architecture: "Architecture", maintainability: "Maintainability", "security-hygiene": "Security hygiene (signals only)",
  "testing-ci": "Testing and CI", documentation: "Documentation", "maintenance-activity": "Maintenance activity",
};
const table = (head: string[], rows: (string | number | null | undefined)[][]): string =>
  rows.length === 0 ? "_None._\n" : `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n")}\n`;

function findingBlock(f: Finding): string {
  const loc = safe(f.locations.slice(0, 5).map((l) => `${l.path}${l.startLine ? `:${l.startLine}` : ""}`).join(", "));
  const ev = safe(f.evidence.map((e) => `${e.kind}${e.note ? ` (${e.note})` : ""}: ${e.refs.slice(0, 6).join(", ")}`).join("; "));
  return [
    `#### ${f.id}: ${safe(f.title)}`,
    `Severity: ${f.severity} | Confidence: ${f.confidence} | Origin: ${f.origin}${f.classification ? ` | Classification: ${f.classification}` : ""}`,
    "", safe(f.explanation), "",
    loc ? `- Locations: ${loc}` : "- Locations: none",
    ev ? `- Evidence: ${ev}` : "- Evidence: none",
    `- Remediation: ${safe(f.remediation)}`,
    f.limitations.length ? `- Limitations: ${safe(f.limitations.join(" "))}` : "",
    "",
  ].filter((l) => l !== "").join("\n");
}

export function toMarkdown(r: Report, opts: { maxFindings?: number } = {}): string {
  const max = opts.maxFindings ?? 100;
  const out: string[] = [];
  out.push(`# RepoLens report: ${safe(r.repository.name)}`, "");
  out.push(`Status: **${r.status}**${r.repository.truncated ? " (truncated by size budget)" : ""}`, "");
  out.push(table(["Field", "Value"], [
    ["Source", `${r.repository.source.type}: ${r.repository.source.location}`], ["Ref", r.repository.source.ref], ["Commit", r.repository.commitSha],
    ["Files analyzed", `${r.repository.analyzedFiles} of ${r.repository.totalFiles}`], ["Schema", r.schemaVersion], ["Tool", r.reproducibility.toolVersion],
  ]));
  out.push("## Summary", "", "### Scores", "", "Scores summarize named sub-metrics. Open the methodology section for formulas. Not assessed means the inputs were missing, not that the value is zero.", "");
  out.push(table(["Dimension", "Score", "State", "Confidence", "Coverage", "Reason"], r.scores.map((s) => [DIM_LABEL[s.dimension], s.value, s.state, s.confidence, pct(s.coverage), s.reason])));
  out.push("### Top recommendations", "");
  out.push(table(["#", "Recommendation", "Effort", "Findings"], r.recommendations.slice(0, 8).map((x) => [x.rank, x.title, x.effort, x.findingIds.length])));
  out.push("## Scope and coverage", "");
  out.push(table(["Language", "Files", "Code lines", "Support level", "Analyzer"], r.scope.languages.map((l) => [l.language, l.files, l.codeLines, l.supportLevel, l.analyzerId])));
  out.push(table(["Analyzer", "Language", "Eligible", "Analyzed", "Coverage"], r.coverage.map((c) => [c.analyzerId, c.language, c.filesEligible, c.filesAnalyzed, pct(c.ratio)])));
  out.push("### Project detection", "");
  out.push(table(["Field", "Value"], [
    ["Package managers", r.detection.packageManagers.join(", ")], ["Frameworks", r.detection.frameworks.map((f) => f.name).join(", ")],
    ["Runtimes", r.detection.runtimes.join(", ")], ["Build tools", r.detection.buildTools.join(", ")],
    ["Entrypoints", r.detection.entrypoints.map((e) => e.path).join(", ")], ["License", r.detection.license.spdxGuess ?? r.detection.license.file],
  ]));
  out.push("## Architecture", "");
  out.push(`Observed from ${r.graph.nodes.length} source files and ${r.graph.edges.length} dependency edges. Import resolution: ${r.graph.resolution.resolved} resolved, ${r.graph.resolution.unresolved} unresolved, ${r.graph.resolution.external} external, ratio ${pct(r.graph.resolution.ratio)}. Module boundaries are inferred from directories.`, "");
  out.push(table(["Module", "Files", "Code lines", "Fan-in", "Fan-out", "Instability"], r.graph.modules.map((m) => [m.path, m.fileCount, m.loc, m.fanIn, m.fanOut, m.instability])));
  const lv = new Map(r.graph.levels.map((l) => [l.moduleId, l.level]));
  const byLevel = [...lv.entries()].map(([id, level]) => ({ level, path: r.graph.modules.find((m) => m.id === id)?.path ?? id })).sort((a, b) => b.level - a.level || a.path.localeCompare(b.path));
  out.push("Inferred dependency levels (0 depends on no other module; higher levels depend on lower ones). Confidence is low or medium because levels are derived from the graph, not from documentation.", "");
  out.push(table(["Level", "Module"], byLevel.map((l) => [l.level, l.path])));
  out.push(table(["Scope", "Size", "Type-only", "Members"], r.graph.cycles.map((c) => [c.scope, c.size, c.typeOnly ? "yes" : "no", c.members.slice(0, 8).join(", ")])));
  out.push("## Code quality", "");
  out.push(`Totals: ${r.metrics.totals.codeLines} code lines, ${r.metrics.totals.commentLines} comment lines, ${r.metrics.totals.blankLines} blank lines. Functions measured: ${r.metrics.functionCount}.`, "");
  const dup = r.metrics.duplication;
  out.push(dup.assessed ? `Duplication: ${pct(dup.ratio)} (${dup.duplicatedLines} of ${dup.totalLines} normalized lines).` : `Duplication: not assessed (${dup.reason}).`, "");
  out.push(table(["Function", "File", "Line", "Complexity"], r.metrics.topFunctions.slice(0, 10).map((f) => [f.name, f.path, f.line, `${f.complexity}${f.approximate ? " (approx.)" : ""}`])));
  out.push("## Security", "", r.security.statement, "");
  out.push(table(["Check", "Assessed", "Result or reason"], [
    ["Dependency vulnerabilities (OSV)", r.security.dependencies.assessed ? "yes" : "no", r.security.dependencies.assessed ? `${r.security.dependencies.vulnerabilities} found in ${r.security.dependencies.packagesChecked} packages` : r.security.dependencies.reason],
    ...r.security.secrets.map((s) => [`Secrets (${s.tool})`, s.assessed ? "yes" : "no", s.assessed ? `${s.findings} possible secrets. ${s.reason ?? ""}` : s.reason]),
    ["GitHub Actions workflows", r.security.workflows.assessed ? "yes" : "no", r.security.workflows.assessed ? `${r.security.workflows.findings} findings` : r.security.workflows.reason],
  ]));
  out.push("## Testing, CI and documentation", "");
  const p = r.practices;
  out.push(table(["Area", "Detected"], [
    ["CI", p.ci.providers.join(", ")], ["Test frameworks", p.tests.frameworks.join(", ")], ["Test files / source files", `${p.tests.testFiles} / ${p.tests.sourceFiles}`],
    ["Linters", p.quality.linters.join(", ")], ["Formatters", p.quality.formatters.join(", ")], ["Type checkers", p.quality.typeCheckers.join(", ")],
    ["README", p.documentation.readme.path ? `${p.documentation.readme.words} words` : "none"], ["Decision records", p.documentation.adrCount],
  ]));
  out.push("Coverage reports are not ingested in this version, so test effectiveness is not assessed.", "");
  out.push("## Git history", "");
  if (r.history.available) {
    out.push(`${r.history.commitsAnalyzed} commits analyzed${r.history.shallow ? " (shallow clone)" : ""}.`, "");
    out.push(table(["Hotspot", "Commits", "Churn", "Complexity", "Score"], r.history.hotspots.map((h) => [h.path, h.commits, h.churn, h.complexity, h.score])));
    out.push(table(["Contributor", "Commits", "Share"], r.history.contributors.slice(0, 8).map((c) => [c.name, c.commits, pct(c.share)])));
  } else out.push(`Not assessed: ${r.history.reason}`, "");
  out.push("## Architecture rules", "");
  out.push(r.rules.evaluated ? `Rules from ${r.rules.source}: ${r.rules.violations} violations${r.rules.baseline ? `, ${r.rules.baseline.suppressed} suppressed by baseline` : ""}.` : "No rules file supplied, so conformance was not evaluated.", "");
  out.push("## Findings", "");
  out.push(`${r.findings.length} findings.${r.findings.length > max ? ` Showing the first ${max}.` : ""}`, "");
  for (const f of r.findings.slice(0, max)) out.push(findingBlock(f));
  out.push("## Methodology", "", `Scoring profile ${r.methodology.profile} version ${r.methodology.scoringVersion} (hash ${r.methodology.profileHash}). Configuration hash ${r.methodology.configHash}.`, "");
  for (const s of r.scores) {
    out.push(`### ${DIM_LABEL[s.dimension]}`, "");
    out.push(table(["Input", "Raw", "Score", "Weight", "Available", "Note"], s.inputs.map((i) => [i.name, i.raw, i.normalized, i.weight, i.available ? "yes" : "no", i.note])));
  }
  out.push("## Limitations", "");
  for (const l of r.limitations) out.push(`- ${safe(l)}`);
  out.push("", "## Reproducibility", "");
  out.push(table(["Field", "Value"], [["Content hash", r.reproducibility.contentHash], ["Commit", r.reproducibility.commitSha], ["Started", r.reproducibility.startedAt], ["Finished", r.reproducibility.finishedAt], ["Node", r.reproducibility.toolVersions.node], ["TypeScript", r.reproducibility.toolVersions.typescript]]));
  return `${out.join("\n")}\n`;
}
