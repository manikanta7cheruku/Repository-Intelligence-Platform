import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./history.js";

export function isSafeGitRef(ref: string): boolean {
  return /^[A-Za-z0-9._\-/~^@{}]{1,200}$/.test(ref) && !ref.startsWith("-") && !ref.includes("..") && !ref.includes("@{") ;
}

/**
 * Checks out a ref into a temporary detached worktree (hardened git, no hooks), runs fn, then removes it.
 * The repository's own working tree and branches are not touched.
 */
export async function withWorktree<T>(repoRoot: string, ref: string, fn: (dir: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!isSafeGitRef(ref)) throw new Error(`Unsafe or invalid ref: ${ref}`);
  const tmp = mkdtempSync(join(tmpdir(), "repolens-wt-"));
  const dir = join(tmp, "tree");
  try {
    await git(["worktree", "add", "--detach", "--force", dir, ref], repoRoot, signal, 120_000);
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`Cannot check out ${ref}: ${(e as Error).message.split("\n")[0]}`);
  }
  try {
    return await fn(dir);
  } finally {
    try {
      await git(["worktree", "remove", "--force", dir], repoRoot, undefined, 60_000);
    } catch {
      // fall through to directory removal
    }
    rmSync(tmp, { recursive: true, force: true });
    try {
      await git(["worktree", "prune"], repoRoot, undefined, 30_000);
    } catch {
      // best effort
    }
  }
}

export async function changedFiles(repoRoot: string, base: string, head: string, signal?: AbortSignal): Promise<string[]> {
  if (!isSafeGitRef(base) || !isSafeGitRef(head)) throw new Error("Unsafe or invalid ref");
  const out = await git(["diff", "--name-only", "--no-renames", `${base}...${head}`], repoRoot, signal, 60_000);
  return out.split("\n").map((l) => l.trim()).filter(Boolean).sort();
}

export async function resolveRef(repoRoot: string, ref: string, signal?: AbortSignal): Promise<string> {
  if (!isSafeGitRef(ref)) throw new Error(`Unsafe or invalid ref: ${ref}`);
  return (await git(["rev-parse", "--verify", `${ref}^{commit}`], repoRoot, signal, 30_000)).trim();
}

/** Files that differ between `base` and the working tree (tracked changes plus untracked files). */
export async function changedFilesWorkingTree(repoRoot: string, base: string, signal?: AbortSignal): Promise<string[]> {
  if (!isSafeGitRef(base)) throw new Error("Unsafe or invalid ref");
  const tracked = await git(["diff", "--name-only", "--no-renames", base], repoRoot, signal, 60_000);
  const untracked = await git(["ls-files", "--others", "--exclude-standard"], repoRoot, signal, 60_000);
  return [...new Set([...tracked.split("\n"), ...untracked.split("\n")].map((l) => l.trim()).filter(Boolean))].sort();
}
