import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { ArchiveError, buildTar, extractTarGz } from "./tar.js";

const limits = {
  maxCompressedBytes: 1_000_000,
  maxExpandedBytes: 5_000_000,
  maxFiles: 100,
  maxFileBytes: 100_000,
};
let dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-tar-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const gz = (entries: Parameters<typeof buildTar>[0]) => gzipSync(buildTar(entries));
const throwsArchive = (fn: () => unknown, re: RegExp) => {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err instanceof ArchiveError).toBe(true);
  expect(String((err as Error).message)).toMatch(re);
};

describe("extractTarGz", () => {
  it("extracts a normal archive and strips the root directory", () => {
    const dest = tmp();
    const r = extractTarGz(
      gz([
        { name: "o-r-abc1234/", type: "5" },
        { name: "o-r-abc1234/src/a.ts", content: "export {}" },
        { name: "o-r-abc1234/README.md", content: "# hi" },
      ]),
      dest,
      limits,
    );
    expect(r.files).toBe(2);
    expect(r.rootDir).toBe("o-r-abc1234");
    expect(readFileSync(join(dest, "src", "a.ts"), "utf8")).toBe("export {}");
  });
  it("rejects path traversal", () => {
    throwsArchive(
      () => extractTarGz(gz([{ name: "root/../../evil.txt", content: "x" }]), tmp(), limits),
      /Unsafe path/,
    );
  });
  it("rejects absolute paths", () => {
    throwsArchive(
      () => extractTarGz(gz([{ name: "/etc/passwd", content: "x" }]), tmp(), limits),
      /Unsafe path/,
    );
  });
  it("skips symbolic and hard links instead of creating them", () => {
    const dest = tmp();
    const r = extractTarGz(
      gz([
        { name: "root/ok.txt", content: "ok" },
        { name: "root/link", type: "2", linkName: "/etc/passwd" },
        { name: "root/hard", type: "1", linkName: "root/ok.txt" },
      ]),
      dest,
      limits,
    );
    expect(r.files).toBe(1);
    expect(r.skipped.map((s) => s.reason).sort()).toEqual([
      "hard link rejected",
      "symbolic link rejected",
    ]);
    expect(readdirSync(dest)).toEqual(["ok.txt"]);
  });
  it("skips device and other special entries", () => {
    const r = extractTarGz(
      gz([
        { name: "root/ok.txt", content: "ok" },
        { name: "root/dev", type: "3" },
      ]),
      tmp(),
      limits,
    );
    expect(r.skipped[0]?.reason).toBe("special entry rejected");
  });
  it("rejects a decompression bomb by expanded size", () => {
    const bomb = gz([{ name: "root/big.txt", content: "A".repeat(2_000_000) }]);
    throwsArchive(
      () => extractTarGz(bomb, tmp(), { ...limits, maxExpandedBytes: 100_000 }),
      /expanded size/,
    );
  });
  it("rejects too many files and oversized compressed archives", () => {
    const many = gz(
      Array.from({ length: 5 }, (_, i) => ({ name: `root/f${i}.txt`, content: "x" })),
    );
    throwsArchive(() => extractTarGz(many, tmp(), { ...limits, maxFiles: 3 }), /file count/);
    throwsArchive(
      () => extractTarGz(many, tmp(), { ...limits, maxCompressedBytes: 10 }),
      /compressed size/,
    );
  });
  it("skips files over the per-file limit", () => {
    const r = extractTarGz(
      gz([
        { name: "root/small.txt", content: "x" },
        { name: "root/large.txt", content: "y".repeat(2000) },
      ]),
      tmp(),
      { ...limits, maxFileBytes: 100 },
    );
    expect(r.files).toBe(1);
    expect(r.skipped[0]?.reason).toBe("file over per-file size limit");
  });
  it("rejects multiple top-level entries", () => {
    throwsArchive(
      () =>
        extractTarGz(
          gz([
            { name: "one/a.txt", content: "x" },
            { name: "two/b.txt", content: "y" },
          ]),
          tmp(),
          limits,
        ),
      /top-level/,
    );
  });
  it("rejects non-gzip input and truncated archives", () => {
    throwsArchive(() => extractTarGz(Buffer.from("not a gzip file"), tmp(), limits), /gzip/);
    const full = buildTar([{ name: "root/a.txt", content: "x".repeat(2000) }]);
    throwsArchive(() => extractTarGz(gzipSync(full.subarray(0, 700)), tmp(), limits), /truncated/);
  });
  it("skips duplicate entries rather than overwriting", () => {
    const dest = tmp();
    const r = extractTarGz(
      gz([
        { name: "root/a.txt", content: "first" },
        { name: "root/a.txt", content: "second" },
      ]),
      dest,
      limits,
    );
    expect(r.files).toBe(1);
    expect(readFileSync(join(dest, "a.txt"), "utf8")).toBe("first");
  });
});
