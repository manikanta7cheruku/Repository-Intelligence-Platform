import type { HistorySummary, PullRequestSummary, ReleaseSummary } from "../ir/types.js";
import { commitQuality } from "./quality.js";
import { unavailable } from "./history.js";

export type JsonFetch = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ActivityOptions {
  token?: string | undefined;
  fetchImpl?: JsonFetch | undefined;
  signal?: AbortSignal | undefined;
  maxCommits?: number;
  authors: "names" | "anonymous";
}

interface ApiCommit {
  commit?: { author?: { name?: string; date?: string }; message?: string };
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

const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Light history for remote repositories using the GitHub REST API (no clone).
 * It gives commit cadence, contributors, commit message quality, pull request and release signals.
 * File level churn and hotspots need a clone, so they are empty here.
 */
export async function fetchGitHubActivity(spec: { owner: string; repo: string; ref: string | null }, opts: ActivityOptions): Promise<HistorySummary> {
  const doFetch: JsonFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i) as ReturnType<JsonFetch>);
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "repolens", "x-github-api-version": "2022-11-28" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const base = `https://api.github.com/repos/${encodeURIComponent(spec.owner)}/${encodeURIComponent(spec.repo)}`;
  const get = async <T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> => {
    try {
      const r = await doFetch(`${base}${path}`, { headers, ...(opts.signal ? { signal: opts.signal } : {}) });
      return { ok: r.ok, status: r.status, data: r.ok ? ((await r.json()) as T) : null };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  };

  const maxCommits = opts.maxCommits ?? 300;
  const commits: ApiCommit[] = [];
  const shaPart = spec.ref ? `&sha=${encodeURIComponent(spec.ref)}` : "";
  for (let page = 1; commits.length < maxCommits && page <= Math.ceil(maxCommits / 100); page++) {
    const r = await get<ApiCommit[]>(`/commits?per_page=100&page=${page}${shaPart}`);
    if (!r.ok || !Array.isArray(r.data)) {
      if (page === 1) return unavailable(r.status === 403 || r.status === 429 ? "GitHub API rate limit reached. Set GITHUB_TOKEN to raise it, or use a local clone." : `GitHub API commits request failed (status ${r.status})`);
      break;
    }
    commits.push(...r.data);
    if (r.data.length < 100) break;
  }
  if (commits.length === 0) return unavailable("The GitHub API returned no commits");

  const totals = new Map<string, number>();
  const dates: number[] = [];
  for (const c of commits) {
    const name = c.commit?.author?.name?.trim() || "unknown";
    totals.set(name, (totals.get(name) ?? 0) + 1);
    const t = Date.parse(c.commit?.author?.date ?? "");
    if (Number.isFinite(t)) dates.push(t);
  }
  dates.sort((a, b) => a - b);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const label = new Map(ranked.map(([n], i) => [n, opts.authors === "anonymous" ? `Author ${i + 1}` : n]));
  const total = commits.length;

  const pulls = await get<ApiPull[]>("/pulls?state=closed&per_page=100&sort=updated&direction=desc");
  let pullRequests: PullRequestSummary | null = null;
  if (pulls.ok && Array.isArray(pulls.data)) {
    const merged = pulls.data.filter((p) => p.merged_at);
    const hours = merged.map((p) => (Date.parse(p.merged_at as string) - Date.parse(p.created_at ?? "")) / 3_600_000).filter((h) => Number.isFinite(h) && h >= 0).sort((a, b) => a - b);
    pullRequests = { sampled: pulls.data.length, merged: merged.length, medianHoursToMerge: hours.length > 0 ? round(hours[Math.floor(hours.length / 2)] as number, 1) : null };
  }
  const rel = await get<ApiRelease[]>("/releases?per_page=100");
  let releases: ReleaseSummary | null = null;
  if (rel.ok && Array.isArray(rel.data)) {
    const published = rel.data.filter((r) => !r.draft);
    const latest = published.map((r) => r.published_at ?? r.created_at ?? "").filter(Boolean).sort().pop() ?? null;
    releases = { count: published.length, latestDate: latest };
  }

  return {
    available: true, reason: null, source: "github-api", commitQuality: commitQuality(commits.map((c) => (c.commit?.message ?? "").split("\n")[0] as string)),
    pullRequests, releases, shallow: null, commitsAnalyzed: total,
    window: { first: dates.length ? new Date(dates[0] as number).toISOString() : null, last: dates.length ? new Date(dates[dates.length - 1] as number).toISOString() : null },
    contributors: ranked.slice(0, 20).map(([n, c]) => ({ name: label.get(n) as string, commits: c, share: round(c / total) })),
    topAuthorShare: round((ranked[0] as [string, number])[1] / total), hotspots: [], moduleOwnership: [],
    limitations: [
      `Based on the ${total} most recent commits returned by the GitHub API. Older history is not included.`,
      "File level churn, hotspots and module ownership need a local clone (analyze a local checkout or use --with-history).",
      "Pull request signals come from the most recent 100 closed pull requests.",
      "Author identity is the commit author name. Squash merges attribute work to the person who merged.",
    ],
  };
}
