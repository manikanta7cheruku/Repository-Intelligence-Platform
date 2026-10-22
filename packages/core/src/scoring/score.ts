import type { Confidence, DetectionSummary, FileRecord, Finding, GraphModel, HistorySummary, Metrics, PracticesSummary, ScoreRecord, SecuritySummary, SubMetricInput } from "../ir/types.js";
import { THRESHOLDS } from "../findings/generate.js";
import { applyCurve, type ScoringProfile } from "./profile.js";

export interface ScoreInputs {
  profile: ScoringProfile;
  files: FileRecord[];
  graph: GraphModel;
  metrics: Metrics;
  practices: PracticesSummary;
  detection: DetectionSummary;
  history: HistorySummary;
  security: SecuritySummary;
  findings: Finding[];
  rulesEvaluated: boolean;
  ruleViolations: number;
  languages: string[];
  truncated: boolean;
  maxCommits: number;
}

type Raw = { raw: number | null; note: string };

const confidenceOf = (coverage: number): Confidence => (coverage >= 0.85 ? "high" : coverage >= 0.6 ? "medium" : "low");
const round = (n: number, d = 4): number => Math.round(n * 10 ** d) / 10 ** d;

export function structuralCoverage(files: FileRecord[]): number | null {
  const eligible = files.filter((f) => f.language !== null && (f.kind === "source"));
  if (eligible.length === 0) return null;
  return eligible.filter((f) => f.analyzed).length / eligible.length;
}

export function computeScores(i: ScoreInputs): ScoreRecord[] {
  const sourceFiles = i.files.filter((f) => f.kind === "source" && f.language !== null);
  const covered = structuralCoverage(i.files);
  const resolution = i.graph.resolution.ratio;
  const nodes = i.graph.nodes.length;
  const raws: Record<string, Record<string, Raw>> = {};

  const runtimeCycleFiles = new Set<string>();
  for (const c of i.graph.cycles) if (c.scope === "file" && !c.typeOnly) for (const m of c.members) runtimeCycleFiles.add(m);
  const moduleCycleMembers = new Set<string>();
  for (const c of i.graph.cycles) if (c.scope === "module") for (const m of c.members) moduleCycleMembers.add(m);
  raws.architecture = {
    "file-cycle-ratio": nodes >= 3 ? { raw: runtimeCycleFiles.size / nodes, note: `${runtimeCycleFiles.size} of ${nodes} files in runtime cycles` } : { raw: null, note: "Fewer than 3 files in the graph" },
    "module-cycle-ratio": i.graph.modules.length >= 2 ? { raw: moduleCycleMembers.size / i.graph.modules.length, note: `${moduleCycleMembers.size} of ${i.graph.modules.length} modules in cycles` } : { raw: null, note: "Fewer than 2 modules" },
    "rule-violations-per-100-edges": i.rulesEvaluated && i.graph.edges.length > 0 ? { raw: (i.ruleViolations / i.graph.edges.length) * 100, note: `${i.ruleViolations} violations over ${i.graph.edges.length} edges` } : { raw: null, note: i.rulesEvaluated ? "No edges" : "No rules file supplied" },
    "unresolved-import-ratio": i.graph.resolution.internalImports >= 10 && resolution !== null ? { raw: 1 - resolution, note: `${i.graph.resolution.unresolved} of ${i.graph.resolution.internalImports} internal imports unresolved` } : { raw: null, note: "Fewer than 10 internal imports" },
    "high-fan-out-share": nodes >= 10 ? { raw: i.graph.nodes.filter((n) => n.fanOut > THRESHOLDS.fanOutFile).length / nodes, note: `files with fan-out above ${THRESHOLDS.fanOutFile}` } : { raw: null, note: "Fewer than 10 files" },
  };

  const testPaths = new Set(i.files.filter((f) => f.kind === "test").map((f) => f.path));
  const dist = i.metrics.complexityDistribution;
  const fnTotal = dist ? dist.low + dist.moderate + dist.high + dist.veryHigh : 0;
  const hotspotCount = i.history.hotspots.filter((h) => (h.score ?? 0) >= THRESHOLDS.hotspotScore).length;
  raws.maintainability = {
    "high-complexity-function-share": dist && fnTotal >= 10 ? { raw: (dist.high + dist.veryHigh) / fnTotal, note: `${dist.high + dist.veryHigh} of ${fnTotal} functions above the high threshold` } : { raw: null, note: "Fewer than 10 measured functions" },
    "duplication-ratio": i.metrics.duplication.assessed && i.metrics.duplication.ratio !== null ? { raw: i.metrics.duplication.ratio, note: `${i.metrics.duplication.duplicatedLines} of ${i.metrics.duplication.totalLines} lines` } : { raw: null, note: i.metrics.duplication.reason ?? "Duplication not assessed" },
    "oversized-file-share": sourceFiles.length >= 5 ? { raw: i.metrics.files.filter((f) => f.codeLines > 500 && !testPaths.has(f.path)).length / sourceFiles.length, note: "source files above 500 code lines" } : { raw: null, note: "Fewer than 5 source files" },
    "hotspot-share": i.history.available && sourceFiles.length > 0 && i.history.hotspots.some((h) => h.score !== null) ? { raw: hotspotCount / sourceFiles.length, note: `${hotspotCount} hotspots with score at least ${THRESHOLDS.hotspotScore}` } : { raw: null, note: i.history.available ? "No complexity data for hotspots" : "No Git history" },
  };

  const weightOf = (sev: string) => (sev === "critical" ? 10 : sev === "high" ? 5 : sev === "medium" ? 2 : sev === "low" ? 1 : 0);
  const wfWeight = (sev: string) => (sev === "high" ? 5 : sev === "medium" ? 2 : sev === "low" ? 0.5 : 0);
  const osv = i.findings.filter((f) => f.ruleId === "security.osv");
  const secrets = i.findings.filter((f) => f.ruleId.startsWith("security.secret."));
  const wf = i.findings.filter((f) => f.ruleId.startsWith("security.workflow."));
  const secretsAssessed = i.security.secrets.some((s) => s.assessed);
  const hasManifest = i.detection.manifests.length > 0;
  raws["security-hygiene"] = {
    "vulnerable-dependency-weight": i.security.dependencies.assessed ? { raw: osv.reduce((s, f) => s + weightOf(f.severity), 0), note: `${osv.length} known vulnerabilities` } : { raw: null, note: i.security.dependencies.reason ?? "Not assessed" },
    "secret-findings": secretsAssessed ? { raw: secrets.length, note: `${secrets.length} possible secrets` } : { raw: null, note: "No secret scanner ran" },
    "workflow-risk-weight": i.security.workflows.assessed ? { raw: wf.reduce((s, f) => s + wfWeight(f.severity), 0), note: `${wf.length} workflow findings` } : { raw: null, note: i.security.workflows.reason ?? "No workflows" },
    "lockfile-present": hasManifest ? { raw: i.detection.lockfiles.length > 0 ? 1 : 0, note: i.detection.lockfiles.length > 0 ? "lockfile found" : "no lockfile" } : { raw: null, note: "No dependency manifest" },
  };

  const p = i.practices;
  const codeLangs = i.languages.some((l) => ["javascript", "typescript", "python"].includes(l));
  raws["testing-ci"] = {
    "test-to-source-file-ratio": p.tests.testToSourceFileRatio !== null ? { raw: p.tests.testToSourceFileRatio, note: `${p.tests.testFiles} test files, ${p.tests.sourceFiles} source files` } : { raw: null, note: "No source files" },
    "ci-present": sourceFiles.length > 0 ? { raw: p.ci.providers.length > 0 ? 1 : 0, note: p.ci.providers.join(", ") || "none detected" } : { raw: null, note: "No source files" },
    "lint-or-format": sourceFiles.length > 0 ? { raw: (p.quality.linters.length > 0 ? 1 : 0) + (p.quality.formatters.length > 0 ? 1 : 0), note: [...p.quality.linters, ...p.quality.formatters].join(", ") || "none detected" } : { raw: null, note: "No source files" },
    "type-checking": codeLangs ? { raw: p.quality.typeCheckers.length > 0 ? 1 : 0, note: p.quality.typeCheckers.join(", ") || "none detected" } : { raw: null, note: "Not applicable to the detected languages" },
  };

  const d = p.documentation;
  const readmeScore = d.readme.path === null ? 0 : 50 + (d.readme.hasInstall ? 25 : 0) + (d.readme.hasUsage ? 25 : 0);
  raws.documentation = {
    "readme-completeness": { raw: readmeScore, note: d.readme.path ?? "no README" },
    "community-files": { raw: [d.files.license, d.files.contributing, d.files.codeOfConduct, d.files.security, d.files.changelog].filter(Boolean).length, note: "license, contributing, code of conduct, security, changelog" },
    "docs-and-decisions": { raw: (d.docsDirectory ? 1 : 0) + (d.adrCount > 0 ? 1 : 0), note: `${d.adrCount} decision records` },
    "setup-aids": { raw: Object.values(p.setup).filter(Boolean).length, note: "Dockerfile, env example, Makefile, devcontainer" },
  };

  const h = i.history;
  let perMonth: number | null = null;
  if (h.available && h.window.first && h.window.last && h.commitsAnalyzed) {
    const months = Math.max(1, (Date.parse(h.window.last) - Date.parse(h.window.first)) / (30.44 * 86_400_000));
    perMonth = h.commitsAnalyzed / months;
  }
  const enough = h.available && (h.commitsAnalyzed ?? 0) >= 10;
  raws["maintenance-activity"] = {
    "author-concentration": enough && h.topAuthorShare !== null ? { raw: h.topAuthorShare, note: "top author share of commits" } : { raw: null, note: h.available ? "Fewer than 10 commits" : (h.reason ?? "No Git history") },
    "commits-per-month": enough && perMonth !== null ? { raw: round(perMonth, 2), note: `${h.commitsAnalyzed} commits in the analyzed window` } : { raw: null, note: h.available ? "Fewer than 10 commits" : (h.reason ?? "No Git history") },
  };

  const securityChecks = [i.security.dependencies.assessed, secretsAssessed, i.security.workflows.assessed];
  const coverageFor: Record<string, number | null> = {
    architecture: covered === null ? null : Math.min(covered, resolution ?? 1),
    maintainability: covered,
    "security-hygiene": securityChecks.filter(Boolean).length / securityChecks.length,
    "testing-ci": i.truncated ? 0.8 : 1,
    documentation: i.truncated ? 0.8 : 1,
    "maintenance-activity": !h.available ? null : h.shallow ? 0.5 : (h.commitsAnalyzed ?? 0) >= i.maxCommits ? 0.8 : 1,
  };

  const order = ["architecture", "maintainability", "security-hygiene", "testing-ci", "documentation", "maintenance-activity"] as const;
  return order.map((dimension): ScoreRecord => {
    const defs = i.profile.dimensions[dimension] ?? [];
    const total = defs.reduce((s, x) => s + x.weight, 0);
    const inputs: SubMetricInput[] = defs.map((def) => {
      const r = (raws[dimension] ?? {})[def.name] ?? { raw: null, note: "Not computed" };
      const available = r.raw !== null;
      return { name: def.name, raw: r.raw === null ? null : round(r.raw), normalized: r.raw === null ? null : round(applyCurve(def.curve, r.raw), 1), weight: def.weight, available, note: r.note };
    });
    const availWeight = inputs.filter((x) => x.available).reduce((s, x) => s + x.weight, 0);
    const cov = coverageFor[dimension] ?? null;
    if (availWeight < total * i.profile.minAvailableWeight || cov === null) {
      const missing = inputs.filter((x) => !x.available).map((x) => `${x.name} (${x.note})`);
      return { dimension, state: "not-assessed", value: null, confidence: null, coverage: cov === null ? null : round(cov), reason: cov === null && availWeight >= total * i.profile.minAvailableWeight ? "No analyzable source files" : `Only ${Math.round((availWeight / total) * 100)} percent of the score inputs could be computed. Missing: ${missing.join("; ")}`, inputs };
    }
    const value = inputs.filter((x) => x.available).reduce((s, x) => s + (x.normalized as number) * x.weight, 0) / availWeight;
    return { dimension, state: "assessed", value: Math.round(value), confidence: confidenceOf(cov), coverage: round(cov), reason: null, inputs };
  });
}
