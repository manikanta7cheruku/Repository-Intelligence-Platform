import { REPORT_SCHEMA_VERSION } from "./types.js";

/**
 * Upgrades a report written by an earlier tool version so it can be opened again.
 * Only additive changes are upgraded. Values that did not exist are filled with "unknown" (null or false), never invented,
 * and a limitation line says the report was upgraded. Returns null when the report is too old or not a report.
 */
export function upgradeReport(
  input: unknown,
): { report: unknown; upgradedFrom: string | null } | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  const v = typeof r.schemaVersion === "string" ? r.schemaVersion : "";
  if (
    v === REPORT_SCHEMA_VERSION ||
    v.startsWith(`${REPORT_SCHEMA_VERSION.split(".").slice(0, 2).join(".")}.`)
  )
    return { report: input, upgradedFrom: null };
  if (!/^0\.3\.\d+$/.test(v)) return null;

  const copy = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  const history = copy.history as Record<string, unknown> | undefined;
  if (history && typeof history === "object") {
    history.totalCommits ??= null;
    history.totalContributors ??= null;
    history.totalContributorsAtLeast ??= false;
    history.exactTotals ??= false;
    const pr = history.pullRequests as Record<string, unknown> | null | undefined;
    if (pr) pr.exact ??= false;
    const rel = history.releases as Record<string, unknown> | null | undefined;
    if (rel) rel.exact ??= false;
  }
  copy.schemaVersion = REPORT_SCHEMA_VERSION;
  const repro = copy.reproducibility as Record<string, unknown> | undefined;
  if (repro) repro.schemaVersion = REPORT_SCHEMA_VERSION;
  const limitations = Array.isArray(copy.limitations) ? (copy.limitations as string[]) : [];
  limitations.push(
    `This report was created with schema ${v} and upgraded to ${REPORT_SCHEMA_VERSION} when opened. History totals, contributor totals and pull request totals did not exist then, so they show as unknown. Analyze again for exact numbers.`,
  );
  copy.limitations = limitations;
  return { report: copy, upgradedFrom: v };
}
