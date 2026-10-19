/**
 * Phase 0 placeholder. The real intermediate representation and report
 * schema are designed in docs/architecture and implemented in Phase 1.
 */
export const REPORT_SCHEMA_VERSION = "0.0.0";

export type Confidence = "high" | "medium" | "low";

export function describeEngine(): string {
  return `RepoLens core, report schema ${REPORT_SCHEMA_VERSION}`;
}
