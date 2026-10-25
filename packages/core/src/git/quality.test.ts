import { describe, expect, it } from "vitest";
import { commitQuality } from "./quality.js";
import { fetchGitHubActivity, type JsonFetch } from "./activity.js";

describe("commitQuality", () => {
  it("measures conventional, descriptive and generic subjects and ignores merges", () => {
    const q = commitQuality(["feat(api): add health endpoint", "fix: handle null user", "update", "wip", "Merge branch 'main' into x", "Refactor the settings validation layer"]);
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

const res = (data: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(data) });
const commit = (name: string, date: string, msg: string) => ({ commit: { author: { name, date }, message: msg } });

describe("fetchGitHubActivity", () => {
  const fetchImpl: JsonFetch = (url) => {
    if (url.includes("/commits")) return res([commit("Ana", "2024-03-01T00:00:00Z", "feat: a\n\nbody"), commit("Ana", "2024-02-01T00:00:00Z", "fix: b"), commit("Bo", "2024-01-01T00:00:00Z", "update")]);
    if (url.includes("/pulls")) return res([{ merged_at: "2024-01-02T12:00:00Z", created_at: "2024-01-02T00:00:00Z" }, { merged_at: null, created_at: "2024-01-01T00:00:00Z" }]);
    return res([{ published_at: "2024-02-15T00:00:00Z" }, { published_at: "2024-01-15T00:00:00Z", draft: true }]);
  };
  it("builds history, quality, pull request and release signals without a clone", async () => {
    const h = await fetchGitHubActivity({ owner: "o", repo: "r", ref: null }, { fetchImpl, authors: "names" });
    expect(h).toMatchObject({ available: true, source: "github-api", commitsAnalyzed: 3, topAuthorShare: 0.667 });
    expect(h.contributors[0]).toMatchObject({ name: "Ana", commits: 2 });
    expect(h.pullRequests).toEqual({ sampled: 2, merged: 1, medianHoursToMerge: 12 });
    expect(h.releases).toEqual({ count: 1, latestDate: "2024-02-15T00:00:00Z" });
    expect(h.commitQuality?.conventionalShare).toBeCloseTo(0.667, 2);
    expect(h.hotspots).toEqual([]);
    expect(h.limitations.join(" ")).toMatch(/local clone/);
  });
  it("anonymizes authors on request", async () => {
    const h = await fetchGitHubActivity({ owner: "o", repo: "r", ref: null }, { fetchImpl, authors: "anonymous" });
    expect(h.contributors.map((c) => c.name)).toEqual(["Author 1", "Author 2"]);
  });
  it("is not assessed, with a clear reason, when rate limited or failing", async () => {
    const limited = await fetchGitHubActivity({ owner: "o", repo: "r", ref: null }, { fetchImpl: () => res({}, false, 403), authors: "names" });
    expect(limited).toMatchObject({ available: false, commitsAnalyzed: null });
    expect(limited.reason).toMatch(/rate limit/);
    const down = await fetchGitHubActivity({ owner: "o", repo: "r", ref: null }, { fetchImpl: () => Promise.reject(new Error("x")), authors: "names" });
    expect(down.available).toBe(false);
  });
  it("still returns commits when pull requests and releases fail", async () => {
    const partial: JsonFetch = (url) => (url.includes("/commits") ? res([commit("Ana", "2024-03-01T00:00:00Z", "feat: a")]) : res({}, false, 500));
    const h = await fetchGitHubActivity({ owner: "o", repo: "r", ref: "main" }, { fetchImpl: partial, authors: "names" });
    expect(h.available).toBe(true);
    expect(h.pullRequests).toBeNull();
    expect(h.releases).toBeNull();
  });
  it("sends the token only as an authorization header and requests the given ref", async () => {
    const seen: { url: string; auth?: string }[] = [];
    const spy: JsonFetch = (url, init) => {
      seen.push({ url, auth: init.headers.authorization });
      return fetchImpl(url, init);
    };
    await fetchGitHubActivity({ owner: "o", repo: "r", ref: "release/1" }, { fetchImpl: spy, token: "tok", authors: "names" });
    expect(seen.every((s) => s.auth === "Bearer tok")).toBe(true);
    expect(seen[0]?.url).toContain("sha=release%2F1");
  });
});
