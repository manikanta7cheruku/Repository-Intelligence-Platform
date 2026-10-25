import type { HistorySummary, PullRequestSummary, ReleaseSummary } from "../ir/types.js";
import { unavailable } from "./history.js";
import { commitQuality } from "./quality.js";

export type JsonFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

export interface ActivityOptions {
  token?: string | undefined;
  fetchImpl?: JsonFetch | undefined;
  signal?: AbortSignal | undefined;
  /** Commits read in full for message quality and the sample. Totals do not depend on it. */
  maxCommits?: number;
  authors: "names" | "anonymous";
}

interface ApiCommit {
  commit?: { author?: { name?: string; date?: string }; message?: string };
  parents?: unknown[];
}
interface ApiPull {
  merged_at?: string | null;
  created_at?: string;
}
interface ApiRelease {
  published_at?: string | null;
  created_at?: string;
  draft?: boolean;
}
interface ApiContributor {
  login?: string;
  name?: string;
  contributions?: number;
}

const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

type Call<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  lastPage: number | null;
  limited: boolean;
};

/** A small GitHub REST client. Every call is independent: one failure never discards the others. */
function client(spec: { owner: string; repo: string }, opts: ActivityOptions) {
  const doFetch: JsonFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i) as ReturnType<JsonFetch>);
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "repolens",
    "x-github-api-version": "2022-11-28",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const base = `https://api.github.com/repos/${encodeURIComponent(spec.owner)}/${encodeURIComponent(spec.repo)}`;
  let limited = false;
  const get = async <T>(path: string, absolute = false): Promise<Call<T>> => {
    try {
      const r = await doFetch(absolute ? `https://api.github.com${path}` : `${base}${path}`, {
        headers,
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      const link = r.headers?.get("link") ?? null;
      const last = link ? /[?&]page=(\d+)>;\s*rel="last"/.exec(link) : null;
      const rateLimited = r.status === 429 || (r.status === 403 && !r.ok);
      if (rateLimited) limited = true;
      return {
        ok: r.ok,
        status: r.status,
        data: r.ok ? ((await r.json()) as T) : null,
        lastPage: last ? Number(last[1]) : null,
        limited: rateLimited,
      };
    } catch {
      return { ok: false, status: 0, data: null, lastPage: null, limited: false };
    }
  };
  return { get, wasLimited: () => limited };
}

/** Pull request and release signals. Totals are exact when the search API answers, a sample otherwise. */
export async function fetchGitHubSignals(
  spec: { owner: string; repo: string },
  opts: ActivityOptions,
): Promise<{
  pullRequests: PullRequestSummary | null;
  releases: ReleaseSummary | null;
  limited: boolean;
}> {
  const c = client(spec, opts);
  const [pulls, search, rel] = await Promise.all([
    c.get<ApiPull[]>("/pulls?state=closed&per_page=100&sort=updated&direction=desc"),
    c.get<{ total_count?: number }>(
      `/search/issues?q=${encodeURIComponent(`repo:${spec.owner}/${spec.repo} is:pr is:merged`)}&per_page=1`,
      true,
    ),
    c.get<ApiRelease[]>("/releases?per_page=100"),
  ]);
  let pullRequests: PullRequestSummary | null = null;
  if (pulls.ok && Array.isArray(pulls.data)) {
    const merged = pulls.data.filter((p) => p.merged_at);
    const hours = merged
      .map((p) => (Date.parse(p.merged_at as string) - Date.parse(p.created_at ?? "")) / 3_600_000)
      .filter((h) => Number.isFinite(h) && h >= 0)
      .sort((a, b) => a - b);
    const exactTotal = search.ok && typeof search.data?.total_count === "number";
    pullRequests = {
      sampled: pulls.data.length,
      merged: exactTotal ? (search.data?.total_count as number) : merged.length,
      exact: exactTotal,
      medianHoursToMerge:
        hours.length > 0 ? round(hours[Math.floor(hours.length / 2)] as number, 1) : null,
    };
  } else if (search.ok && typeof search.data?.total_count === "number") {
    pullRequests = {
      sampled: 0,
      merged: search.data.total_count,
      exact: true,
      medianHoursToMerge: null,
    };
  }
  let releases: ReleaseSummary | null = null;
  if (rel.ok && Array.isArray(rel.data)) {
    const published = rel.data.filter((r) => !r.draft);
    const latest =
      published
        .map((r) => r.published_at ?? r.created_at ?? "")
        .filter(Boolean)
        .sort()
        .pop() ?? null;
    releases = { count: published.length, exact: rel.data.length < 100, latestDate: latest };
  }
  return { pullRequests, releases, limited: c.wasLimited() };
}

/**
 * History for remote repositories from the GitHub REST API (no clone).
 * Totals (commits, first and last commit, contributors, merged pull requests, releases) are exact. Message quality uses a
 * sample of recent commits. File level churn and hotspots need a clone, so they are empty here.
 */
export async function fetchGitHubActivity(
  spec: { owner: string; repo: string; ref: string | null },
  opts: ActivityOptions,
): Promise<HistorySummary> {
  const c = client(spec, opts);
  const maxCommits = opts.maxCommits ?? 100;
  const shaPart = spec.ref ? `&sha=${encodeURIComponent(spec.ref)}` : "";

  // One commit per page: the page count of the last link is the exact number of commits.
  const head = await c.get<ApiCommit[]>(`/commits?per_page=1${shaPart}`);
  if (!head.ok || !Array.isArray(head.data)) {
    return unavailable(
      head.limited
        ? "GitHub API rate limit reached. Set GITHUB_TOKEN to raise it, or use a local clone."
        : head.status === 404 || head.status === 409
          ? "The repository has no readable commit history on this branch."
          : `GitHub API commits request failed (status ${head.status})`,
    );
  }
  if (head.data.length === 0) return unavailable("The GitHub API returned no commits");
  const totalCommits = head.lastPage ?? head.data.length;
  const lastDate = head.data[0]?.commit?.author?.date ?? null;

  const [oldest, contributorsRes, signals] = await Promise.all([
    totalCommits > 1
      ? c.get<ApiCommit[]>(`/commits?per_page=1&page=${totalCommits}${shaPart}`)
      : Promise.resolve(null),
    c.get<ApiContributor[]>("/contributors?per_page=100&anon=1"),
    fetchGitHubSignals(spec, opts),
  ]);
  const firstDate =
    oldest?.ok && Array.isArray(oldest.data)
      ? (oldest.data[0]?.commit?.author?.date ?? null)
      : totalCommits === 1
        ? lastDate
        : null;

  // A recent sample for message quality. Merge commits are left out, as a path limited local log also drops them.
  const commits: ApiCommit[] = [];
  for (let page = 1; commits.length < maxCommits && page <= Math.ceil(maxCommits / 100); page++) {
    const r = await c.get<ApiCommit[]>(`/commits?per_page=100&page=${page}${shaPart}`);
    if (!r.ok || !Array.isArray(r.data)) break;
    commits.push(...r.data);
    if (r.data.length < 100) break;
  }
  const sampled = commits.filter((x) => !x.parents || x.parents.length < 2);

  let contributors: { name: string; commits: number; share: number }[] = [];
  let totalContributors: number | null = null;
  let atLeast = false;
  let topShare: number | null = null;
  const rows =
    contributorsRes.ok && Array.isArray(contributorsRes.data)
      ? contributorsRes.data
          .map((r) => ({ name: r.login ?? r.name ?? "unknown", commits: r.contributions ?? 0 }))
          .filter((r) => r.commits > 0)
          .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
      : [];
  if (rows.length > 0) {
    const sum = rows.reduce((a, r) => a + r.commits, 0);
    contributors = rows.slice(0, 20).map((r, i) => ({
      name: opts.authors === "anonymous" ? `Author ${i + 1}` : r.name,
      commits: r.commits,
      share: round(r.commits / Math.max(sum, 1)),
    }));
    totalContributors = rows.length;
    atLeast = rows.length >= 100 && contributorsRes.lastPage !== null;
    topShare = round((rows[0] as { commits: number }).commits / Math.max(sum, 1));
  } else if (sampled.length > 0) {
    const totals = new Map<string, number>();
    for (const x of sampled) {
      const n = x.commit?.author?.name?.trim() || "unknown";
      totals.set(n, (totals.get(n) ?? 0) + 1);
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    contributors = ranked.slice(0, 20).map(([n, k], i) => ({
      name: opts.authors === "anonymous" ? `Author ${i + 1}` : n,
      commits: k,
      share: round(k / sampled.length),
    }));
    topShare = round((ranked[0] as [string, number])[1] / sampled.length);
  }

  const notes: string[] = [];
  if (c.wasLimited() || signals.limited)
    notes.push(
      "The GitHub API rate limit was reached, so some signals are missing. Set GITHUB_TOKEN to raise it (60 requests per hour without a token).",
    );
  if (signals.pullRequests && !signals.pullRequests.exact)
    notes.push(
      "The merged pull request count comes from the 100 most recently updated closed pull requests, not from every pull request.",
    );
  if (atLeast)
    notes.push("The repository has at least 100 contributors. The number shown is a lower bound.");

  return {
    available: true,
    reason: null,
    source: "github-api",
    commitQuality: commitQuality(
      sampled.map((x) => (x.commit?.message ?? "").split("\n")[0] as string),
    ),
    pullRequests: signals.pullRequests,
    releases: signals.releases,
    shallow: null,
    totalCommits,
    totalContributors,
    totalContributorsAtLeast: atLeast,
    exactTotals: true,
    commitsAnalyzed: sampled.length > 0 ? sampled.length : null,
    window: {
      first: firstDate ? new Date(firstDate).toISOString() : null,
      last: lastDate ? new Date(lastDate).toISOString() : null,
    },
    contributors,
    topAuthorShare: topShare,
    hotspots: [],
    moduleOwnership: [],
    limitations: [
      `Totals (${totalCommits} commits, first and last commit, contributors, pull requests) cover the whole history. Commit message quality uses the ${sampled.length} most recent commits without merges.`,
      "File level churn, hotspots and module ownership need a local clone (analyze a local checkout or use --with-history).",
      "Author identity is the account login or commit author name. Squash merges attribute work to the person who merged.",
      ...notes,
    ],
  };
}
