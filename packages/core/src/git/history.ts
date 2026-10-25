import { execFile } from "node:child_process";
import { devNull } from "node:os";
import { promisify } from "node:util";
import type { HistoryHotspot, HistorySummary } from "../ir/types.js";
import { commitQuality } from "./quality.js";

const run = promisify(execFile);

/** Config flags that stop repository supplied configuration from running programs. */
export const HARDENING_FLAGS = [
  "-c",
  `core.hooksPath=${devNull}`,
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.pager=cat",
  "-c",
  "core.quotepath=false",
  "-c",
  "credential.helper=",
  "-c",
  "protocol.ext.allow=never",
  "-c",
  "protocol.file.allow=user",
];

function gitEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT,
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_ALLOW_PROTOCOL: "https:file",
    LC_ALL: "C",
  };
}

export async function git(
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutMs = 60_000,
): Promise<string> {
  const { stdout } = await run("git", [...HARDENING_FLAGS, "--no-pager", ...args], {
    cwd,
    env: gitEnv(),
    maxBuffer: 256 * 1024 * 1024,
    timeout: timeoutMs,
    ...(signal ? { signal } : {}),
  });
  return stdout;
}

export interface RepoHead {
  commitSha: string | null;
  branch: string | null;
  shallow: boolean | null;
  prefix: string;
}

/** Reads HEAD information. Returns null when the directory is not inside a usable Git repository. */
export async function readHead(root: string, signal?: AbortSignal): Promise<RepoHead | null> {
  try {
    const inside = (await git(["rev-parse", "--is-inside-work-tree"], root, signal)).trim();
    if (inside !== "true") return null;
    const prefix = (await git(["rev-parse", "--show-prefix"], root, signal)).trim();
    const sha = (await git(["rev-parse", "HEAD"], root, signal).catch(() => "")).trim();
    const branch = (
      await git(["rev-parse", "--abbrev-ref", "HEAD"], root, signal).catch(() => "")
    ).trim();
    const shallow = (
      await git(["rev-parse", "--is-shallow-repository"], root, signal).catch(() => "")
    ).trim();
    return {
      commitSha: /^[0-9a-f]{40}$/.test(sha) ? sha : null,
      branch: branch && branch !== "HEAD" ? branch : null,
      shallow: shallow === "true" ? true : shallow === "false" ? false : null,
      prefix,
    };
  } catch {
    return null;
  }
}

export interface HistoryOptions {
  maxCommits: number;
  authors: "names" | "anonymous";
  hotspotLimit: number;
}

export interface HistoryInputs {
  /** File paths present in the analysis, with max complexity when available. */
  files: Map<string, number | null>;
  moduleOf: (path: string) => { id: string; path: string } | null;
  /** Receives commits and churn for every file in the analysis. Used by the risk index. */
  fileStatsSink?: Map<string, { commits: number; churn: number }>;
}

interface FileStat {
  commits: number;
  churn: number;
  authors: Map<string, number>;
}

export function unavailable(reason: string): HistorySummary {
  return {
    available: false,
    reason,
    source: null,
    commitQuality: null,
    pullRequests: null,
    releases: null,
    shallow: null,
    commitsAnalyzed: null,
    window: { first: null, last: null },
    contributors: [],
    topAuthorShare: null,
    hotspots: [],
    moduleOwnership: [],
    limitations: [],
  };
}

const percentile = (sorted: number[], v: number): number => {
  const below = sorted.filter((x) => x < v).length;
  const equal = sorted.filter((x) => x === v).length;
  return (below + 0.5 * equal) / sorted.length;
};

export interface ParsedCommit {
  author: string;
  date: string;
  subject: string;
  files: { path: string; churn: number }[];
}

export function parseLog(output: string): ParsedCommit[] {
  const commits: ParsedCommit[] = [];
  for (const chunk of output.split("\x1e")) {
    if (chunk.trim() === "") continue;
    const lines = chunk.split("\n");
    const header = (lines[0] ?? "").split("\x1f");
    if (header.length < 3) continue;
    const files: { path: string; churn: number }[] = [];
    for (const l of lines.slice(1)) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(l);
      if (!m) continue;
      const churn = (m[1] === "-" ? 0 : Number(m[1])) + (m[2] === "-" ? 0 : Number(m[2]));
      files.push({ path: m[3] as string, churn });
    }
    commits.push({
      author: (header[1] as string).trim() || "unknown",
      date: header[2] as string,
      subject: (header[3] ?? "").trim(),
      files,
    });
  }
  return commits;
}

export async function collectHistory(
  root: string,
  head: RepoHead,
  opts: HistoryOptions,
  inputs: HistoryInputs,
  signal?: AbortSignal,
): Promise<HistorySummary> {
  let out: string;
  try {
    out = await git(
      [
        "log",
        "--no-renames",
        "--numstat",
        `-n${opts.maxCommits}`,
        "--format=%x1e%H%x1f%aN%x1f%aI%x1f%s",
        "--",
        ".",
      ],
      root,
      signal,
      120_000,
    );
  } catch (e) {
    return unavailable(`git log failed: ${(e as Error).message.split("\n")[0]}`);
  }
  const commits = parseLog(out);
  if (commits.length === 0) return unavailable("Repository has no commits in the analyzed path");

  const authorTotals = new Map<string, number>();
  const stats = new Map<string, FileStat>();
  for (const c of commits) {
    authorTotals.set(c.author, (authorTotals.get(c.author) ?? 0) + 1);
    for (const f of c.files) {
      const path =
        head.prefix && f.path.startsWith(head.prefix) ? f.path.slice(head.prefix.length) : f.path;
      if (head.prefix && !f.path.startsWith(head.prefix)) continue;
      const s = stats.get(path) ?? { commits: 0, churn: 0, authors: new Map<string, number>() };
      s.commits++;
      s.churn += f.churn;
      s.authors.set(c.author, (s.authors.get(c.author) ?? 0) + 1);
      stats.set(path, s);
    }
  }

  const ranked = [...authorTotals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const label = new Map(
    ranked.map(([name], i) => [name, opts.authors === "anonymous" ? `Author ${i + 1}` : name]),
  );
  const total = commits.length;
  const contributors = ranked.slice(0, 20).map(([name, n]) => ({
    name: label.get(name) as string,
    commits: n,
    share: Math.round((n / total) * 1000) / 1000,
  }));

  const candidates = [...stats.entries()].filter(([p]) => inputs.files.has(p));
  if (inputs.fileStatsSink)
    for (const [p, st] of candidates)
      inputs.fileStatsSink.set(p, { commits: st.commits, churn: st.churn });
  const commitCounts = candidates.map(([, s]) => s.commits).sort((a, b) => a - b);
  const complexities = [...inputs.files.values()]
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const hotspots: HistoryHotspot[] = candidates
    .map(([path, s]) => {
      const cx = inputs.files.get(path) ?? null;
      const score =
        cx === null || complexities.length === 0
          ? null
          : Math.round(100 * percentile(commitCounts, s.commits) * percentile(complexities, cx));
      return { path, commits: s.commits, churn: s.churn, complexity: cx, score };
    })
    .filter((h) => h.commits >= 2)
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) || b.commits - a.commits || a.path.localeCompare(b.path),
    )
    .slice(0, opts.hotspotLimit);

  const moduleAuthors = new Map<
    string,
    { path: string; id: string; authors: Map<string, number>; commits: number }
  >();
  for (const [path, s] of candidates) {
    const m = inputs.moduleOf(path);
    if (!m) continue;
    const rec = moduleAuthors.get(m.id) ?? {
      path: m.path,
      id: m.id,
      authors: new Map(),
      commits: 0,
    };
    rec.commits += s.commits;
    for (const [a, n] of s.authors) rec.authors.set(a, (rec.authors.get(a) ?? 0) + n);
    moduleAuthors.set(m.id, rec);
  }
  const moduleOwnership = [...moduleAuthors.values()]
    .map((m) => {
      const top = [...m.authors.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0] as [string, number];
      const sum = [...m.authors.values()].reduce((x, y) => x + y, 0);
      return {
        moduleId: m.id,
        path: m.path,
        topAuthor: label.get(top[0]) as string,
        share: Math.round((top[1] / sum) * 1000) / 1000,
        commits: m.commits,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const limitations = [
    "File renames are not followed, so a renamed file starts a new history.",
    "Squash merges attribute the whole change to the squasher, which can hide real authorship.",
    "Author identity is the commit author name. The same person under different names is counted separately.",
    "Churn and commit counts measure change activity, not quality or effort.",
  ];
  if (head.shallow)
    limitations.unshift(
      "The repository is a shallow clone, so history is incomplete and ownership is biased toward recent authors.",
    );
  if (commits.length >= opts.maxCommits)
    limitations.unshift(`History was limited to the most recent ${opts.maxCommits} commits.`);

  return {
    available: true,
    reason: null,
    source: "git",
    commitQuality: commitQuality(commits.map((c) => c.subject)),
    pullRequests: null,
    releases: null,
    shallow: head.shallow,
    commitsAnalyzed: total,
    window: {
      first: (commits[commits.length - 1] as { date: string }).date,
      last: (commits[0] as { date: string }).date,
    },
    contributors,
    topAuthorShare: Math.round(((ranked[0] as [string, number])[1] / total) * 1000) / 1000,
    hotspots,
    moduleOwnership,
    limitations,
  };
}

/** Arguments for a hardened shallow clone used only when history for a remote repository is requested. */
export function buildCloneArgs(
  url: string,
  dest: string,
  depth: number,
  ref: string | null,
): string[] {
  const args = [
    ...HARDENING_FLAGS,
    "-c",
    "protocol.allow=never",
    "-c",
    "protocol.https.allow=always",
    "clone",
    `--depth=${Math.max(1, Math.floor(depth))}`,
    "--no-tags",
    "--single-branch",
    "--no-checkout",
    "--no-recurse-submodules",
    "--template=",
  ];
  if (ref) args.push(`--branch=${ref}`);
  args.push("--", url, dest);
  return args;
}

export async function cloneForHistory(
  url: string,
  dest: string,
  depth: number,
  ref: string | null,
  signal?: AbortSignal,
): Promise<void> {
  await run("git", buildCloneArgs(url, dest, depth, ref), {
    env: { ...gitEnv(), GIT_ALLOW_PROTOCOL: "https" },
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
    ...(signal ? { signal } : {}),
  });
}
