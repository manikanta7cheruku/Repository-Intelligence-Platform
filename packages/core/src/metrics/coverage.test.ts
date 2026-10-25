import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openLocalWorkspace } from "../acquire/local.js";
import { resolveConfig } from "../config/config.js";
import {
  ingestCoverage,
  matchRepoPath,
  parseCobertura,
  parseIstanbulSummary,
  parseLcov,
} from "./coverage.js";

let dirs: string[] = [];
const ws = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), "rl-cov-"));
  dirs.push(d);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return openLocalWorkspace(d, resolveConfig({}));
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("coverage parsers", () => {
  it("parses LCOV using LF and LH, and falls back to DA lines", () => {
    const p = parseLcov(
      "SF:src/a.ts\nDA:1,1\nDA:2,0\nLF:2\nLH:1\nend_of_record\nSF:src/b.ts\nDA:1,3\nDA:2,2\nend_of_record\n",
    );
    expect(p.files).toEqual([
      { path: "src/a.ts", total: 2, covered: 1 },
      { path: "src/b.ts", total: 2, covered: 2 },
    ]);
    expect(p.lineRate).toBe(0.75);
  });
  it("parses the Istanbul summary", () => {
    const p = parseIstanbulSummary(
      JSON.stringify({
        total: { lines: { total: 10, covered: 8, pct: 80 } },
        "/x/src/a.ts": { lines: { total: 10, covered: 8, pct: 80 } },
      }),
    );
    expect(p?.lineRate).toBe(0.8);
    expect(p?.files).toHaveLength(1);
    expect(parseIstanbulSummary("not json")).toBeNull();
    expect(parseIstanbulSummary("{}")).toBeNull();
  });
  it("parses Cobertura XML", () => {
    const xml =
      '<coverage line-rate="0.5"><packages><package><classes><class name="a" filename="pkg/a.py" line-rate="0.5"><lines><line number="1" hits="1"/><line number="2" hits="0"/></lines></class></classes></package></packages></coverage>';
    const p = parseCobertura(xml);
    expect(p?.files).toEqual([{ path: "pkg/a.py", total: 2, covered: 1 }]);
    expect(p?.lineRate).toBe(0.5);
    expect(parseCobertura("<html/>")).toBeNull();
  });
});

describe("matchRepoPath", () => {
  const repo = new Set(["apps/web/src/a.ts", "apps/api/src/a.ts", "src/b.ts"]);
  const byBase = new Map<string, string[]>([
    ["a.ts", ["apps/web/src/a.ts", "apps/api/src/a.ts"]],
    ["b.ts", ["src/b.ts"]],
  ]);
  it("matches exact, absolute and package-relative paths and refuses ambiguity", () => {
    expect(matchRepoPath("src/b.ts", repo, byBase)).toBe("src/b.ts");
    expect(matchRepoPath("/home/ci/build/apps/web/src/a.ts", repo, byBase)).toBe(
      "apps/web/src/a.ts",
    );
    expect(matchRepoPath("./src/b.ts", repo, byBase)).toBe("src/b.ts");
    expect(matchRepoPath("src/a.ts", repo, byBase)).toBeNull();
    expect(matchRepoPath("nope.ts", repo, byBase)).toBeNull();
  });
});

describe("ingestCoverage", () => {
  it("finds a coverage report in the repository and maps it to files", () => {
    const w = ws({
      "src/a.ts": "x",
      "coverage/lcov.info": "SF:/ci/work/src/a.ts\nLF:10\nLH:5\nend_of_record\n",
    });
    const r = ingestCoverage(w, new Set(["src/a.ts"]));
    expect(r.summary).toMatchObject({
      ingested: true,
      format: "lcov",
      lineRate: 0.5,
      filesMatched: 1,
      source: "coverage/lcov.info",
    });
    expect(r.perFile.get("src/a.ts")).toBe(0.5);
  });
  it("uses a supplied report and says so when none exists (not zero)", () => {
    const none = ingestCoverage(ws({ "a.ts": "x" }), new Set(["a.ts"]));
    expect(none.summary).toMatchObject({ ingested: false, lineRate: null });
    expect(none.summary.reason).toMatch(/--coverage/);
    const supplied = ingestCoverage(ws({ "a.ts": "x" }), new Set(["a.ts"]), {
      name: "cobertura-coverage.xml",
      text: '<coverage line-rate="1"><class filename="a.ts"><lines><line number="1" hits="2"/></lines></class></coverage>',
    });
    expect(supplied.summary).toMatchObject({ ingested: true, format: "cobertura", lineRate: 1 });
  });
  it("is not ingested when the report is unusable", () => {
    expect(
      ingestCoverage(ws({}), new Set(), { name: "lcov.info", text: "garbage" }).summary.ingested,
    ).toBe(false);
  });
});
