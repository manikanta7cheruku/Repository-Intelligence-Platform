import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  commitFromRootDir,
  type FetchLike,
  openGitHubArchive,
  parseGitHubUrl,
  type StreamFetchLike,
} from "../acquire/github.js";
import { AcquisitionError, openLocalWorkspace } from "../acquire/local.js";
import { extractTarGzStream } from "../acquire/tar-stream.js";
import type { Workspace } from "../acquire/types.js";
import type { AnalysisConfig } from "../config/config.js";
import { cloneForHistory } from "../git/history.js";

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
  streamFetchImpl?: StreamFetchLike | undefined;
}

export function isGitHubTarget(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

/** Turns a CLI or API target (local path or GitHub URL) into a bounded workspace. */
export async function acquireTarget(target: string, opts: AcquireOptions): Promise<AcquiredTarget> {
  if (!isGitHubTarget(target)) {
    const root = resolve(target);
    const workspace = openLocalWorkspace(root, opts.config);
    return {
      workspace,
      source: {
        type: "local",
        location: root,
        ref: opts.ref ?? null,
        name: root.split(/[\\/]/).filter(Boolean).pop() ?? root,
      },
      commitSha: null,
      historyRoot: root,
      cleanup: () => undefined,
    };
  }
  const spec = parseGitHubUrl(target);
  const ref = opts.ref ?? spec.ref;
  const tmp = mkdtempSync(join(tmpdir(), "repolens-"));
  const cleanup = () => rmSync(tmp, { recursive: true, force: true });
  try {
    const archive = await openGitHubArchive(
      { ...spec, ref },
      {
        maxBytes: opts.config.budgets.maxArchiveBytes,
        token: opts.token,
        signal: opts.signal,
        fetchImpl: opts.streamFetchImpl,
      },
    );
    const dest = join(tmp, "src");
    const result = await extractTarGzStream(
      archive.body,
      dest,
      {
        maxDownloadBytes: opts.config.budgets.maxArchiveBytes,
        maxScanBytes: Math.max(opts.config.budgets.maxExpandedBytes, 2 * 1024 * 1024 * 1024),
        maxKeptBytes: opts.config.budgets.maxTotalBytes,
        maxFiles: opts.config.budgets.maxFiles,
        maxFileBytes: opts.config.budgets.maxFileBytes,
      },
      opts.signal,
    );
    const workspace = openLocalWorkspace(dest, opts.config);
    const skippedNote = result.skipped
      .filter(
        (x) =>
          x.reason.startsWith("binary") ||
          x.reason.includes("budget") ||
          x.reason.includes("size limit"),
      )
      .map((x) => `${x.count} ${x.reason}`);
    if (result.truncated) {
      workspace.truncated = true;
      workspace.limitations.push(
        `The repository is larger than the analysis budget, so only part of it was analyzed (${skippedNote.join("; ")}).`,
      );
    }
    workspace.skipped = result.skippedFiles;
    for (const x of result.skipped)
      if (x.reason.startsWith("inside "))
        workspace.excluded.push({
          reason: `directory excluded: ${x.reason.slice(7)}`,
          count: x.count,
        });
    let historyRoot: string | null = null;
    if (opts.withHistory) {
      const cloneDir = join(tmp, "history");
      await cloneForHistory(
        `https://github.com/${spec.owner}/${spec.repo}.git`,
        cloneDir,
        opts.config.history.maxCommits,
        ref,
        opts.signal,
      );
      historyRoot = cloneDir;
    }
    return {
      workspace,
      source: {
        type: "github",
        location: `https://github.com/${spec.owner}/${spec.repo}`,
        ref,
        name: `${spec.owner}/${spec.repo}`,
      },
      commitSha: commitFromRootDir(result.rootDir),
      historyRoot,
      cleanup,
    };
  } catch (e) {
    cleanup();
    if (e instanceof AcquisitionError) throw e;
    throw e;
  }
}
