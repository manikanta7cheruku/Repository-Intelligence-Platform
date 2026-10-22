import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AnalysisConfig } from "../config/config.js";
import { AcquisitionError, openLocalWorkspace } from "../acquire/local.js";
import { commitFromRootDir, fetchGitHubArchive, parseGitHubUrl, type FetchLike } from "../acquire/github.js";
import { extractTarGz } from "../acquire/tar.js";
import { cloneForHistory } from "../git/history.js";
import type { Workspace } from "../acquire/types.js";

export interface AcquiredTarget {
  workspace: Workspace;
  source: { type: "local" | "github"; location: string; ref: string | null; name: string };
  commitSha: string | null;
  historyRoot: string | null;
  cleanup(): void;
}

export interface AcquireOptions {
  config: AnalysisConfig;
  ref?: string | null;
  token?: string | undefined;
  withHistory?: boolean;
  signal?: AbortSignal | undefined;
  fetchImpl?: FetchLike | undefined;
}

export function isGitHubTarget(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

/** Turns a CLI or API target (local path or GitHub URL) into a bounded workspace. */
export async function acquireTarget(target: string, opts: AcquireOptions): Promise<AcquiredTarget> {
  if (!isGitHubTarget(target)) {
    const root = resolve(target);
    const workspace = openLocalWorkspace(root, opts.config);
    return { workspace, source: { type: "local", location: root, ref: opts.ref ?? null, name: root.split(/[\\/]/).filter(Boolean).pop() ?? root }, commitSha: null, historyRoot: root, cleanup: () => undefined };
  }
  const spec = parseGitHubUrl(target);
  const ref = opts.ref ?? spec.ref;
  const tmp = mkdtempSync(join(tmpdir(), "repolens-"));
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  try {
    const archive = await fetchGitHubArchive({ ...spec, ref }, { maxBytes: opts.config.budgets.maxArchiveBytes, token: opts.token, signal: opts.signal, fetchImpl: opts.fetchImpl });
    const dest = join(tmp, "src");
    const result = extractTarGz(archive.data, dest, {
      maxCompressedBytes: opts.config.budgets.maxArchiveBytes, maxExpandedBytes: opts.config.budgets.maxExpandedBytes,
      maxFiles: opts.config.budgets.maxFiles, maxFileBytes: opts.config.budgets.maxFileBytes,
    });
    const workspace = openLocalWorkspace(dest, opts.config);
    let historyRoot: string | null = null;
    if (opts.withHistory) {
      const cloneDir = join(tmp, "history");
      await cloneForHistory(`https://github.com/${spec.owner}/${spec.repo}.git`, cloneDir, opts.config.history.maxCommits, ref, opts.signal);
      historyRoot = cloneDir;
    }
    return { workspace, source: { type: "github", location: `https://github.com/${spec.owner}/${spec.repo}`, ref, name: `${spec.owner}/${spec.repo}` }, commitSha: commitFromRootDir(result.rootDir), historyRoot, cleanup };
  } catch (e) {
    cleanup();
    if (e instanceof AcquisitionError) throw e;
    throw e;
  }
}
