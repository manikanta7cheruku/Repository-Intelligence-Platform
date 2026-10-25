import { describe, expect, it } from "vitest";
import { fetchGitHubActivity, type JsonFetch } from "./activity.js";
import { commitQuality } from "./quality.js";

describe("commitQuality", () => {
  it("measures conventional, descriptive and generic subjects and ignores merges", () => {
    const q = commitQuality([
      "feat(api): add health endpoint",
      "fix: handle null user",
      "update",
      "wip",
      "Merge branch 'main' into x",
      "Refactor the settings validation layer",
    ]);
    expect(q?.sampled).toBe(5);
    expect(q?.conventionalShare).toBe(0.4);
    expect(q?.genericShare).toBe(0.4);
    expect(q?.descriptiveShare).toBe(0.6);
  });
  it("returns null for no usable commits", () => {
    expect(commitQuality([])).toBeNull();
    expect(commitQuality(["Merge pull request #1", ""])).toBeNull();
  });
});

const _res = (data: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(data) });
const commit = (name: string, date: string, msg: string) => ({
  commit: { author: { name, date }, message: msg },
});

const linkLast = (page: number) => ({
  get: (n: string) =>
    n.toLowerCase() === "link"
      ? `<https://api.github.com/x?per_page=1&page=${page}>; rel="last"`
      : null,
});
const respond = (data: unknown, extra: { headers?: unknown; ok?: boolean; status?: number } = {}) =>
  Promise.resolve({
    ok: extra.ok ?? true,
    status: extra.status ?? 200,
    headers: extra.headers as { get(n: string): string | null } | undefined,
    json: () => Promise.resolve(data),
  });

/** A fake GitHub: 1,539 commits in total, a 3 commit sample, 3 contributors, 17 merged pull requests. */
const github =
  (over: Partial<Record<string, () => ReturnType<typeof respond>>> = {}): JsonFetch =>
  (url) => {
    const pick = (key: string) => over[key];
    if (url.includes("/search/issues")) return pick("search")?.() ?? respond({ total_count: 17 });
    if (url.includes("/contributors"))
      return (
        pick("contributors")?.() ??
        respond([
          { login: "ana", contributions: 1400 },
          { login: "bo", contributions: 130 },
          { login: "cy", contributions: 9 },
        ])
      );
    if (url.includes("/pulls"))
      return (
        pick("pulls")?.() ??
        respond([
          { merged_at: "2024-01-02T12:00:00Z", created_at: "2024-01-02T00:00:00Z" },
          { merged_at: null, created_at: "2024-01-01T00:00:00Z" },
        ])
      );
    if (url.includes("/releases"))
      return (
        pick("releases")?.() ??
        respond([
          { published_at: "2024-02-15T00:00:00Z" },
          { published_at: "2024-01-15T00:00:00Z", draft: true },
        ])
      );
    if (url.includes("per_page=1&page=1539"))
      return respond([commit("Ana", "2023-01-05T00:00:00Z", "chore: init")]);
    if (/per_page=1(&|$)/.test(url))
      return (
        pick("head")?.() ??
        respond([commit("Ana", "2024-03-01T00:00:00Z", "feat: a")], { headers: linkLast(1539) })
      );
    return respond([
      commit("Ana", "2024-03-01T00:00:00Z", "feat: a\n\nbody"),
      commit("Ana", "2024-02-01T00:00:00Z", "fix: b"),
      commit("Bo", "2024-01-01T00:00:00Z", "update"),
    ]);
  };

describe("fetchGitHubActivity", () => {
  const spec = { owner: "o", repo: "r", ref: null };
  it("reports the exact number of commits, not the size of the sample", async () => {
    const h = await fetchGitHubActivity(spec, { fetchImpl: github(), authors: "names" });
    expect(h).toMatchObject({
      available: true,
      source: "github-api",
      totalCommits: 1539,
      exactTotals: true,
      commitsAnalyzed: 3,
    });
    expect(h.window).toEqual({
      first: "2023-01-05T00:00:00.000Z",
      last: "2024-03-01T00:00:00.000Z",
    });
    expect(h.limitations.join(" ")).toMatch(/1539 commits/);
  });
  it("takes contributors from the whole history and shares from their commit counts", async () => {
    const h = await fetchGitHubActivity(spec, { fetchImpl: github(), authors: "names" });
    expect(h.totalContributors).toBe(3);
    expect(h.totalContributorsAtLeast).toBe(false);
    expect(h.contributors[0]).toMatchObject({ name: "ana", commits: 1400 });
    expect(h.topAuthorShare).toBeCloseTo(1400 / 1539, 3);
  });
  it("uses the search total for merged pull requests and says when it is only a sample", async () => {
    const exact = await fetchGitHubActivity(spec, { fetchImpl: github(), authors: "names" });
    expect(exact.pullRequests).toEqual({
      sampled: 2,
      merged: 17,
      exact: true,
      medianHoursToMerge: 12,
    });
    expect(exact.releases).toEqual({ count: 1, exact: true, latestDate: "2024-02-15T00:00:00Z" });
    const sample = await fetchGitHubActivity(spec, {
      fetchImpl: github({ search: () => respond({}, { ok: false, status: 403 }) }),
      authors: "names",
    });
    expect(sample.pullRequests).toEqual({
      sampled: 2,
      merged: 1,
      exact: false,
      medianHoursToMerge: 12,
    });
    expect(sample.limitations.join(" ")).toMatch(/not from every pull request/);
    expect(sample.limitations.join(" ")).toMatch(/rate limit/);
  });
  it("counts a repository with a single commit and no link header", async () => {
    const h = await fetchGitHubActivity(spec, {
      fetchImpl: github({
        head: () => respond([commit("Ana", "2024-03-01T00:00:00Z", "feat: a")]),
      }),
      authors: "names",
    });
    expect(h.totalCommits).toBe(1);
    expect(h.window.first).toBe("2024-03-01T00:00:00.000Z");
  });
  it("does not count merge commits in the quality sample", async () => {
    const withMerge: JsonFetch = (url, init) =>
      url.includes("per_page=100")
        ? respond([
            {
              ...commit("Ana", "2024-03-01T00:00:00Z", "Merge pull request #1"),
              parents: [{}, {}],
            },
            { ...commit("Ana", "2024-02-01T00:00:00Z", "feat: b"), parents: [{}] },
          ])
        : github()(url, init);
    const h = await fetchGitHubActivity(spec, { fetchImpl: withMerge, authors: "names" });
    expect(h.commitsAnalyzed).toBe(1);
    expect(h.totalCommits).toBe(1539);
  });
  it("anonymizes authors on request", async () => {
    const h = await fetchGitHubActivity(spec, { fetchImpl: github(), authors: "anonymous" });
    expect(h.contributors.map((c) => c.name)).toEqual(["Author 1", "Author 2", "Author 3"]);
  });
  it("is not assessed, with a clear reason, when rate limited or failing", async () => {
    const limited = await fetchGitHubActivity(spec, {
      fetchImpl: () => respond({}, { ok: false, status: 403 }),
      authors: "names",
    });
    expect(limited).toMatchObject({ available: false, totalCommits: null });
    expect(limited.reason).toMatch(/rate limit/);
    const down = await fetchGitHubActivity(spec, {
      fetchImpl: () => Promise.reject(new Error("x")),
      authors: "names",
    });
    expect(down.available).toBe(false);
  });
  it("keeps the totals when contributors, pull requests and releases fail", async () => {
    const fail = () => respond({}, { ok: false, status: 500 });
    const h = await fetchGitHubActivity(spec, {
      fetchImpl: github({ contributors: fail, pulls: fail, search: fail, releases: fail }),
      authors: "names",
    });
    expect(h.available).toBe(true);
    expect(h.totalCommits).toBe(1539);
    expect(h.pullRequests).toBeNull();
    expect(h.releases).toBeNull();
    expect(h.contributors.length).toBeGreaterThan(0);
  });
  it("sends the token only as an authorization header and requests the given ref", async () => {
    const seen: { url: string; auth?: string }[] = [];
    const spy: JsonFetch = (url, init) => {
      seen.push({ url, auth: init.headers.authorization });
      return github()(url, init);
    };
    await fetchGitHubActivity(
      { owner: "o", repo: "r", ref: "release/1" },
      { fetchImpl: spy, token: "tok", authors: "names" },
    );
    expect(seen.every((x) => x.auth === "Bearer tok")).toBe(true);
    expect(seen[0]?.url).toContain("sha=release%2F1");
  });
});
