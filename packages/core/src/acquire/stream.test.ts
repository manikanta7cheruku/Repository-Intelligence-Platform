import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { GitHubUrlError, openGitHubArchive, type StreamFetchLike } from "./github.js";
import { ArchiveError, buildTar } from "./tar.js";
import { extractTarGzStream, type StreamLimits } from "./tar-stream.js";

const limits: StreamLimits = {
  maxDownloadBytes: 5_000_000,
  maxScanBytes: 50_000_000,
  maxKeptBytes: 5_000_000,
  maxFiles: 100,
  maxFileBytes: 100_000,
};
let dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-stream-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Delivers the archive in small pieces, like a network stream. */
async function* chunked(buf: Buffer, size = 777): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
}
const archive = (entries: Parameters<typeof buildTar>[0]) => gzipSync(buildTar(entries));

describe("extractTarGzStream", () => {
  it("keeps analyzable files from a chunked stream and strips the root directory", async () => {
    const dest = tmp();
    const r = await extractTarGzStream(
      chunked(
        archive([
          { name: "o-r-abc1234/", type: "5" },
          { name: "o-r-abc1234/src/a.ts", content: "export const a = 1;\n" },
          { name: "o-r-abc1234/README.md", content: "# hi\n" },
        ]),
      ),
      dest,
      limits,
    );
    expect(r.files).toBe(2);
    expect(r.rootDir).toBe("o-r-abc1234");
    expect(readFileSync(join(dest, "src", "a.ts"), "utf8")).toBe("export const a = 1;\n");
    expect(r.truncated).toBe(false);
  });

  it("skips dependency folders, binary and oversized files instead of failing, and reports them", async () => {
    const dest = tmp();
    const r = await extractTarGzStream(
      chunked(
        archive([
          { name: "r/src/a.ts", content: "x" },
          { name: "r/node_modules/dep/index.js", content: "x".repeat(500) },
          { name: "r/assets/logo.png", content: "x".repeat(2000) },
          { name: "r/data/big.json", content: "x".repeat(200_000) },
        ]),
      ),
      dest,
      limits,
    );
    expect(r.files).toBe(1);
    expect(existsSync(join(dest, "node_modules"))).toBe(false);
    expect(existsSync(join(dest, "assets", "logo.png"))).toBe(false);
    const reasons = r.skipped.map((s) => s.reason).join("|");
    expect(reasons).toMatch(/node_modules/);
    expect(reasons).toMatch(/binary or media/);
    expect(reasons).toMatch(/per-file size limit/);
    expect(r.skippedBytes).toBeGreaterThan(200_000);
  });

  it("marks the result truncated, without failing, when the file count budget runs out", async () => {
    const dest = tmp();
    const entries = Array.from({ length: 10 }, (_, i) => ({
      name: `r/src/f${i}.ts`,
      content: "x",
    }));
    const r = await extractTarGzStream(chunked(archive(entries)), dest, { ...limits, maxFiles: 4 });
    expect(r.files).toBe(4);
    expect(r.truncated).toBe(true);
    expect(r.skipped.find((s) => s.reason.includes("file count budget"))?.count).toBe(6);
  });

  it("marks the result truncated when the kept size budget runs out", async () => {
    const dest = tmp();
    const r = await extractTarGzStream(
      chunked(archive([1, 2, 3].map((i) => ({ name: `r/f${i}.ts`, content: "x".repeat(40_000) })))),
      dest,
      { ...limits, maxKeptBytes: 90_000 },
    );
    expect(r.files).toBe(2);
    expect(r.truncated).toBe(true);
  });

  it("rejects traversal, absolute paths and several top-level directories", async () => {
    for (const entries of [
      [{ name: "r/../evil.txt", content: "x" }],
      [{ name: "/etc/passwd", content: "x" }],
      [
        { name: "a/x.ts", content: "x" },
        { name: "b/y.ts", content: "x" },
      ],
    ])
      await expect(extractTarGzStream(chunked(archive(entries)), tmp(), limits)).rejects.toThrow(
        ArchiveError,
      );
  });

  it("skips links and special entries", async () => {
    const r = await extractTarGzStream(
      chunked(
        archive([
          { name: "r/a.ts", content: "x" },
          { name: "r/link", type: "2", linkName: "/etc/passwd" },
          { name: "r/dev", type: "3" },
        ]),
      ),
      tmp(),
      limits,
    );
    expect(r.files).toBe(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(
      expect.arrayContaining(["symbolic link rejected", "special entry rejected"]),
    );
  });

  it("rejects a corrupt or truncated stream and an over-large download", async () => {
    const good = archive([{ name: "r/a.ts", content: "x".repeat(5000) }]);
    await expect(
      extractTarGzStream(chunked(Buffer.from("not gzip at all")), tmp(), limits),
    ).rejects.toThrow(ArchiveError);
    await expect(
      extractTarGzStream(chunked(good.subarray(0, good.length - 40)), tmp(), limits),
    ).rejects.toThrow(ArchiveError);
    await expect(
      extractTarGzStream(chunked(good), tmp(), { ...limits, maxDownloadBytes: 10 }),
    ).rejects.toThrow(/download is larger/);
  });

  it("stops a decompression bomb by the scanned size", async () => {
    const bomb = archive([{ name: "r/zeros.dat", content: "0".repeat(2_000_000) }]);
    await expect(
      extractTarGzStream(chunked(bomb), tmp(), { ...limits, maxScanBytes: 100_000 }),
    ).rejects.toThrow(/too large to scan/);
  });
});

describe("openGitHubArchive", () => {
  const body = chunked(archive([{ name: "r/a.ts", content: "x" }]));
  const ok =
    (extra: Record<string, string> = {}): StreamFetchLike =>
    async () => ({
      status: 200,
      headers: { get: (n: string) => extra[n.toLowerCase()] ?? null },
      body,
    });
  const spec = { owner: "o", repo: "r", ref: null };

  it("downloads from codeload, which has no REST API quota, and defaults to HEAD", async () => {
    const urls: string[] = [];
    const impl: StreamFetchLike = async (url, init) => {
      urls.push(`${url}|${init.headers.authorization ?? ""}`);
      return ok()(url, init);
    };
    const a = await openGitHubArchive(spec, { maxBytes: 1_000_000, fetchImpl: impl, token: "tok" });
    expect(a.body).toBeDefined();
    expect(urls).toEqual(["https://codeload.github.com/o/r/tar.gz/HEAD|"]);
  });

  it("requests a branch with slashes as a path", async () => {
    const urls: string[] = [];
    await openGitHubArchive(
      { owner: "o", repo: "r", ref: "release/1.0" },
      {
        maxBytes: 1_000_000,
        fetchImpl: async (u, i) => {
          urls.push(u);
          return ok()(u, i);
        },
      },
    );
    expect(urls[0]).toBe("https://codeload.github.com/o/r/tar.gz/release/1.0");
  });

  it("explains a download that is over the budget with sizes", async () => {
    await expect(
      openGitHubArchive(spec, {
        maxBytes: 10 * 1048576,
        fetchImpl: ok({ "content-length": String(300 * 1048576) }),
      }),
    ).rejects.toThrow(/300 MB.*budget of 10 MB/);
  });

  it("reports not found and rate limits clearly", async () => {
    const status =
      (code: number): StreamFetchLike =>
      async () => ({ status: code, headers: { get: () => null }, body: null });
    await expect(openGitHubArchive(spec, { maxBytes: 1, fetchImpl: status(404) })).rejects.toThrow(
      /not found, or it is private/,
    );
    await expect(openGitHubArchive(spec, { maxBytes: 1, fetchImpl: status(403) })).rejects.toThrow(
      /rate limit/,
    );
  });

  it("falls back to the API with a token, and never sends the token to codeload", async () => {
    const seen: string[] = [];
    const impl: StreamFetchLike = async (url, init) => {
      seen.push(`${new URL(url).hostname}:${init.headers.authorization ? "auth" : "anon"}`);
      return url.includes("codeload")
        ? { status: 404, headers: { get: () => null }, body: null }
        : ok()(url, init);
    };
    await openGitHubArchive(spec, { maxBytes: 1_000_000, token: "tok", fetchImpl: impl });
    expect(seen).toEqual(["codeload.github.com:anon", "api.github.com:auth"]);
  });

  it("refuses redirects to other hosts", async () => {
    const impl: StreamFetchLike = async () => ({
      status: 302,
      headers: { get: (n: string) => (n === "location" ? "https://evil.example/x.tgz" : null) },
      body: null,
    });
    await expect(openGitHubArchive(spec, { maxBytes: 1, fetchImpl: impl })).rejects.toThrow(
      GitHubUrlError,
    );
  });
});
