export * from "./config/config.js";
export * from "./ir/types.js";
export { reportSchema, validateReport, validateAgainst } from "./ir/schema.js";
export type { ValidationIssue, ReportValidation } from "./ir/schema.js";
export { analyze, contentHashOf, TOOL_VERSION } from "./pipeline/analyze.js";
export type { AnalyzeOptions, Stage } from "./pipeline/analyze.js";
export { acquireTarget, isGitHubTarget } from "./pipeline/target.js";
export type { AcquiredTarget, AcquireOptions } from "./pipeline/target.js";
export { openLocalWorkspace, AcquisitionError } from "./acquire/local.js";
export { parseGitHubUrl, GitHubUrlError, fetchGitHubArchive } from "./acquire/github.js";
export { extractTarGz, ArchiveError } from "./acquire/tar.js";
export { parseRules, RulesError, evaluateRules, parseBaseline } from "./rules/engine.js";
export { toMarkdown } from "./report/markdown.js";
export { toHtml } from "./report/html.js";
export { toMermaid, toDot, toSvg, toMermaidFiles } from "./report/diagram.js";
export { buildExecutiveSummary } from "./report/summary.js";
export { GLOSSARY, GLOSSARY_VERSION, explain, DIMENSION_LABELS } from "./glossary/glossary.js";
export type { GlossaryEntry } from "./glossary/glossary.js";
export { computeBlastRadius, buildReverseIndex, impactOf } from "./graph/impact.js";
export { computeRisk } from "./risk/risk.js";
export { ingestCoverage } from "./metrics/coverage.js";
export { diffReports, diffToMarkdown } from "./report/diff.js";
export type { ReportDiff } from "./report/diff.js";
export { DEFAULT_ANALYZERS } from "./analyzers/registry.js";
export type { AnalyzerPlugin } from "./analyzers/types.js";
export { DEFAULT_PROFILE } from "./scoring/profile.js";
export { SEVERITY_RANK } from "./findings/make.js";

export function describeEngine(): string {
  return "RepoLens core";
}
export { parseYamlSubset, YamlSubsetError } from "./rules/yaml.js";
export { assessPullRequest, prToMarkdown } from "./pr/guardian.js";
export type { PrAssessment, PrVerdict } from "./pr/guardian.js";
export { computeTrend, trendToMarkdown, sparkline, sampleIndexes } from "./trend/trend.js";
export type { TrendReport, TrendPoint } from "./trend/trend.js";
export { analyzeDirectory, analyzeRef, readRulesFrom } from "./pipeline/snapshot.js";
export {
  resolveRef,
  changedFiles,
  changedFilesWorkingTree,
  withWorktree,
  isSafeGitRef,
} from "./git/worktree.js";
export { fetchGitHubActivity } from "./git/activity.js";
export { commitQuality } from "./git/quality.js";
export { compareVersions, nearestFix } from "./util/semver.js";
