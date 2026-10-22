import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AnalysisConfig } from "../config/config.js";
import { GlobSet } from "../util/glob.js";
import type { Workspace, WorkspaceFile } from "./types.js";

/** Directories never entered. The reason is reported so exclusions are never silent. */
const ALWAYS_EXCLUDED_DIRS: Record<string, string> = {
  ".git": "git metadata",
  node_modules: "dependency directory",
  ".hg": "version control metadata",
  ".svn": "version control metadata",
  __pycache__: "bytecode cache",
  ".venv": "virtual environment",
  venv: "virtual environment",
  ".tox": "tooling cache",
  ".mypy_cache": "tooling cache",
  ".pytest_cache": "tooling cache",
  ".next": "build output",
  ".turbo": "tooling cache",
  ".repolens-cache": "tool cache",
};

export class AcquisitionError extends Error {}

/** Walks a local directory deterministically, without following symlinks, within budgets. */
export function openLocalWorkspace(rootInput: string, config: AnalysisConfig): Workspace {
  const root = resolve(rootInput);
  let rootStat: ReturnType<typeof lstatSync>;
  try {
    rootStat = lstatSync(root);
  } catch {
    throw new AcquisitionError(`Path does not exist: ${rootInput}`);
  }
  if (!rootStat.isDirectory()) throw new AcquisitionError(`Not a directory: ${rootInput}`);

  const userExclude = new GlobSet(config.exclude);
  const counts = new Map<string, number>();
  const bump = (reason: string) => counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const files: WorkspaceFile[] = [];
  const limitations: string[] = [];
  let totalBytes = 0;
  let truncated = false;

  const walk = (relDir: string): void => {
    if (truncated) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(join(root, relDir), { withFileTypes: true });
    } catch {
      bump("unreadable directory");
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        bump("symbolic link (not followed)");
        continue;
      }
      if (entry.isDirectory()) {
        const reason = ALWAYS_EXCLUDED_DIRS[entry.name];
        if (reason) {
          bump(`directory excluded: ${reason}`);
          continue;
        }
        if (userExclude.matches(rel) || userExclude.matches(`${rel}/`)) {
          bump("excluded by configuration");
          continue;
        }
        walk(rel);
        continue;
      }
      if (!entry.isFile()) {
        bump("special file");
        continue;
      }
      if (userExclude.matches(rel)) {
        bump("excluded by configuration");
        continue;
      }
      let size: number;
      try {
        size = lstatSync(join(root, rel)).size;
      } catch {
        bump("unreadable file");
        continue;
      }
      if (
        files.length >= config.budgets.maxFiles ||
        totalBytes + size > config.budgets.maxTotalBytes
      ) {
        truncated = true;
        limitations.push(
          `Analysis truncated: file or size budget reached after ${files.length} files. Raise budgets or add exclusions.`,
        );
        return;
      }
      totalBytes += size;
      files.push({ path: rel, bytes: size, absPath: join(root, rel) });
    }
  };
  walk("");

  const index = new Map(files.map((f) => [f.path, f]));
  return {
    root,
    files,
    read(path) {
      const f = index.get(path);
      if (!f || f.bytes > config.budgets.maxFileBytes) return null;
      try {
        return readFileSync(f.absPath, "utf8");
      } catch {
        return null;
      }
    },
    has: (path) => index.has(path),
    excluded: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason)),
    truncated,
    limitations,
  };
}
