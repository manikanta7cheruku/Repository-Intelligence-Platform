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
