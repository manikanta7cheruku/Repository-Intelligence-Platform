import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisConfig } from "../config/config.js";
import { openLocalWorkspace } from "../acquire/local.js";
import { withWorktree } from "../git/worktree.js";
import type { Report } from "../ir/types.js";
import { analyze, type AnalyzeOptions } from "./analyze.js";

export interface SnapshotOptions {
  config: AnalysisConfig;
  rules?: { text: string; name: string } | null;
  baseline?: { text: string } | null;
  osvFetch?: AnalyzeOptions["osvFetch"];
  signal?: AbortSignal | undefined;
}

/** Analyzes a directory exactly as it is on disk, without Git history. Used for comparisons and trends. */
export async function analyzeDirectory(
  dir: string,
  label: string,
  o: SnapshotOptions,
): Promise<Report> {
  const ws = openLocalWorkspace(dir, o.config);
  return analyze({
    config: o.config,
    workspace: ws,
    source: { type: "local", location: label, ref: null, name: label },
    historyRoot: null,
    rules: o.rules ?? null,
    baseline: o.baseline ?? null,
    ...(o.osvFetch ? { osvFetch: o.osvFetch } : {}),
    ...(o.signal ? { signal: o.signal } : {}),
  });
}

/** Analyzes a Git ref in a temporary detached worktree. The repository's working tree is untouched. */
export async function analyzeRef(
  repoRoot: string,
  ref: string,
  label: string,
  o: SnapshotOptions,
): Promise<Report> {
  const report = await withWorktree(
    repoRoot,
    ref,
    (dir) => analyzeDirectory(dir, label, o),
    o.signal,
  );
  return report;
}

export function readRulesFrom(dir: string): { text: string; name: string } | null {
  for (const n of ["repolens.rules.yaml", "repolens.rules.yml", "repolens.rules.json"]) {
    const p = join(dir, n);
    if (existsSync(p)) return { text: readFileSync(p, "utf8"), name: n };
  }
  return null;
}
