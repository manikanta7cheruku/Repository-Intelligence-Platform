/**
 * Browser-safe entry point of the engine. It contains only pure modules (no file system, no child processes, no hashing),
 * so the web application can import it on the client. The web application otherwise consumes the report JSON only.
 */

export type { GlossaryCategory, GlossaryEntry } from "./glossary/glossary.js";
export { DIMENSION_LABELS, explain, GLOSSARY, GLOSSARY_VERSION } from "./glossary/glossary.js";
export type { ReverseIndex } from "./graph/impact.js";
export { buildReverseIndex, impactOf } from "./graph/impact.js";
export type { ReportValidation, ValidationIssue } from "./ir/schema.js";
export { validateReport } from "./ir/schema.js";
export * from "./ir/types.js";
export { upgradeReport } from "./ir/upgrade.js";
export { toDot, toMermaid, toMermaidFiles, toSvg } from "./report/diagram.js";
export type { ReportDiff } from "./report/diff.js";
export { diffReports, diffToMarkdown } from "./report/diff.js";
