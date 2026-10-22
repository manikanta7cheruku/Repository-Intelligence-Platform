import { describe, expect, it } from "vitest";
import {
  commitFromRootDir,
  type FetchLike,
  fetchGitHubArchive,
  GitHubUrlError,
  parseGitHubUrl,
} from "./github.js";

const rejects = (url: string) => {
  let err: unknown;
  try {
    parseGitHubUrl(url);
  } catch (e) {
    err = e;
  }
  expect(err instanceof GitHubUrlError).toBe(true);
};

describe("parseGitHubUrl", () => {
  it("parses repository URLs", () => {
    expect(parseGitHubUrl("https://github.com/octo/repo")).toEqual({
      owner: "octo",
      repo: "repo",
      ref: null,
    });
    expect(parseGitHubUrl("https://github.com/octo/repo.git")).toEqual({
      owner: "octo",
      repo: "repo",
      ref: null,
    });
    expect(parseGitHubUrl("https://github.com/octo/repo/tree/feature/x")).toEqual({
      owner: "octo",
      repo: "repo",
      ref: "feature/x",
    });
  });
  it("rejects hosts, schemes and credentials that could enable SSRF or token theft", () => {
    for (const bad of [
      "http://github.com/o/r",
      "https://evil.com/o/r",
      "https://github.com.evil.com/o/r",
      "https://user:pw@github.com/o/r",
      "https://github.com:8443/o/r",
      "https://127.0.0.1/o/r",
      "https://[::1]/o/r",
      "https://169.254.169.254/latest",
      "file:///etc/passwd",
      "ftp://github.com/o/r",
      "https://github.com/",
      "https://github.com/onlyowner",
      "https://github.com/-bad/r",
      "https://github.com/o/..",
      "javascript:alert(1)",
      "not a url",
    ])
      rejects(bad);
  });
  it("rejects unsafe refs", () => {
    rejects("https://github.com/o/r/tree/..%2F..%2Fetc");
    rejects("https://github.com/o/r/tree/--upload-pack=x");
  });
});

const ok = (
  status: number,
  headers: Record<string, string> = {},
  body = Buffer.from("x"),
): ReturnType<FetchLike> =>
  Promise.resolve({
    status,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    arrayBuffer: () =>
      Promise.resolve(
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
      ),
  });

describe("fetchGitHubArchive", () => {
  it("follows redirects only to allow-listed hosts and never forwards the token across hosts", async () => {
    const seen: { url: string; auth: string | undefined }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      seen.push({ url, auth: init.headers.authorization });
      if (url.startsWith("https://api.github.com/"))
        return ok(302, { location: "https://codeload.github.com/o/r/legacy.tar.gz/main" });
      return ok(200, {}, Buffer.from("data"));
    };
    const r = await fetchGitHubArchive(
      { owner: "o", repo: "r", ref: "main" },
      { maxBytes: 1000, token: "secret-token", fetchImpl },
    );
    expect(r.data.toString()).toBe("data");
    expect(seen[0]?.auth).toBe("Bearer secret-token");
    expect(seen[1]?.auth).toBeUndefined();
  });
  it("refuses redirects to other hosts", async () => {
    const fetchImpl: FetchLike = () =>
      ok(302, { location: "https://169.254.169.254/latest/meta-data" });
    let err: unknown;
    try {
      await fetchGitHubArchive({ owner: "o", repo: "r", ref: null }, { maxBytes: 1000, fetchImpl });
    } catch (e) {
      err = e;
    }
    expect(String((err as Error).message)).toMatch(/Refusing redirect/);
  });
  it("enforces the size budget from content-length and from the body", async () => {
    for (const impl of [
      () => ok(200, { "content-length": "5000" }),
      () => ok(200, {}, Buffer.alloc(5000)),
    ]) {
      let err: unknown;
      try {
        await fetchGitHubArchive(
          { owner: "o", repo: "r", ref: null },
          { maxBytes: 1000, fetchImpl: impl },
        );
      } catch (e) {
        err = e;
      }
      expect(String((err as Error).message)).toMatch(/size budget/);
    }
  });
  it("maps 404 and rate limits to clear errors", async () => {
    for (const [status, re] of [
      [404, /not found|private/],
      [403, /rate limit/],
    ] as const) {
      let err: unknown;
      try {
        await fetchGitHubArchive(
          { owner: "o", repo: "r", ref: null },
          { maxBytes: 1000, fetchImpl: () => ok(status) },
        );
      } catch (e) {
        err = e;
      }
      expect(String((err as Error).message)).toMatch(re);
    }
  });
  it("limits the number of redirects", async () => {
    const fetchImpl: FetchLike = () => ok(302, { location: "https://api.github.com/again" });
    let err: unknown;
    try {
      await fetchGitHubArchive({ owner: "o", repo: "r", ref: null }, { maxBytes: 1000, fetchImpl });
    } catch (e) {
      err = e;
    }
    expect(String((err as Error).message)).toMatch(/Too many redirects/);
  });
});

describe("commitFromRootDir", () => {
  it("reads the short sha from the archive root", () => {
    expect(commitFromRootDir("octo-repo-3fa9c2d")).toBe("3fa9c2d");
    expect(commitFromRootDir("octo-repo")).toBeNull();
    expect(commitFromRootDir(null)).toBeNull();
  });
});
