export { fetchGitHubArchive, GitHubUrlError, parseGitHubUrl } from "./acquire/github.js";
export { AcquisitionError, openLocalWorkspace } from "./acquire/local.js";
export { ArchiveError, extractTarGz } from "./acquire/tar.js";
export { DEFAULT_ANALYZERS } from "./analyzers/registry.js";
export type { AnalyzerPlugin } from "./analyzers/types.js";
export * from "./config/config.js";
export { SEVERITY_RANK } from "./findings/make.js";
export type { ReportValidation, ValidationIssue } from "./ir/schema.js";
export { reportSchema, validateAgainst, validateReport } from "./ir/schema.js";
export * from "./ir/types.js";
export type { AnalyzeOptions, Stage } from "./pipeline/analyze.js";
export { analyze, contentHashOf, TOOL_VERSION } from "./pipeline/analyze.js";
export type { AcquiredTarget, AcquireOptions } from "./pipeline/target.js";
export { acquireTarget, isGitHubTarget } from "./pipeline/target.js";
export type { ReportDiff } from "./report/diff.js";
export { diffReports, diffToMarkdown } from "./report/diff.js";
export { toHtml } from "./report/html.js";
export { toMarkdown } from "./report/markdown.js";
export { evaluateRules, parseBaseline, parseRules, RulesError } from "./rules/engine.js";
export { DEFAULT_PROFILE } from "./scoring/profile.js";

export function describeEngine(): string {
  return "RepoLens core";
}
export { parseYamlSubset, YamlSubsetError } from "./rules/yaml.js";
