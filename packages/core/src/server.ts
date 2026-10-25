/**
 * Entry point for the hosted analysis route. It exposes only what a request needs (acquire a public GitHub
 * repository, analyze it, validate the report) and leaves out the Git worktree, pull request and trend modules.
 */
export { GitHubUrlError, parseGitHubUrl } from "./acquire/github.js";
export { resolveConfig } from "./config/config.js";
export { validateReport } from "./ir/schema.js";
export { analyze } from "./pipeline/analyze.js";
export { acquireTarget } from "./pipeline/target.js";
