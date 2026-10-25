export { fetchGitHubArchive, GitHubUrlError, parseGitHubUrl } from "./acquire/github.js";
export { AcquisitionError, openLocalWorkspace } from "./acquire/local.js";
export { ArchiveError, extractTarGz } from "./acquire/tar.js";
export { DEFAULT_ANALYZERS } from "./analyzers/registry.js";
export type { AnalyzerPlugin } from "./analyzers/types.js";
export * from "./config/config.js";
export { SEVERITY_RANK } from "./findings/make.js";
export type { GlossaryEntry } from "./glossary/glossary.js";
export { DIMENSION_LABELS, explain, GLOSSARY, GLOSSARY_VERSION } from "./glossary/glossary.js";
export { buildReverseIndex, computeBlastRadius, impactOf } from "./graph/impact.js";
export type { ReportValidation, ValidationIssue } from "./ir/schema.js";
export { reportSchema, validateAgainst, validateReport } from "./ir/schema.js";
export * from "./ir/types.js";
export { ingestCoverage } from "./metrics/coverage.js";
export type { AnalyzeOptions, Stage } from "./pipeline/analyze.js";
export { analyze, contentHashOf, TOOL_VERSION } from "./pipeline/analyze.js";
export type { AcquiredTarget, AcquireOptions } from "./pipeline/target.js";
export { acquireTarget, isGitHubTarget } from "./pipeline/target.js";
export { toDot, toMermaid, toMermaidFiles, toSvg } from "./report/diagram.js";
export type { ReportDiff } from "./report/diff.js";
export { diffReports, diffToMarkdown } from "./report/diff.js";
export { toHtml } from "./report/html.js";
export { toMarkdown } from "./report/markdown.js";
export { buildExecutiveSummary } from "./report/summary.js";
export { computeRisk } from "./risk/risk.js";
export { evaluateRules, parseBaseline, parseRules, RulesError } from "./rules/engine.js";
export { DEFAULT_PROFILE } from "./scoring/profile.js";

export function describeEngine(): string {
  return "RepoLens core";
}
export { fetchGitHubActivity } from "./git/activity.js";
export { commitQuality } from "./git/quality.js";
export {
  changedFiles,
  changedFilesWorkingTree,
  isSafeGitRef,
  resolveRef,
  withWorktree,
} from "./git/worktree.js";
export { analyzeDirectory, analyzeRef, readRulesFrom } from "./pipeline/snapshot.js";
export type { PrAssessment, PrVerdict } from "./pr/guardian.js";
export { assessPullRequest, prToMarkdown } from "./pr/guardian.js";
export { parseYamlSubset, YamlSubsetError } from "./rules/yaml.js";
export type { TrendPoint, TrendReport } from "./trend/trend.js";
export { computeTrend, sampleIndexes, sparkline, trendToMarkdown } from "./trend/trend.js";
export { compareVersions, nearestFix } from "./util/semver.js";
