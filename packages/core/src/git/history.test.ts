import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectHistory, detectGitHubRemote, git, parseLog, readHead } from "./history.js";

let dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rl-git-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const g = (cwd: string, args: string[], who = "Alice", day = 1) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: who,
      GIT_AUTHOR_EMAIL: `${who}@x.test`,
      GIT_COMMITTER_NAME: who,
      GIT_COMMITTER_EMAIL: `${who}@x.test`,
      GIT_AUTHOR_DATE: `2024-01-${String(day).padStart(2, "0")}T10:00:00Z`,
      GIT_COMMITTER_DATE: `2024-01-${String(day).padStart(2, "0")}T10:00:00Z`,
    },
  });

function makeRepo(): string {
  const d = tmp();
  g(d, ["init", "-q", "-b", "main"]);
  mkdirSync(join(d, "src"));
  writeFileSync(join(d, "src", "hot.ts"), "export const a = 1;\n");
  writeFileSync(join(d, "src", "cold.ts"), "export const b = 1;\n");
  g(d, ["add", "."]);
  g(d, ["commit", "-q", "-m", "init"], "Alice", 1);
  for (let i = 2; i <= 6; i++) {
    appendFileSync(join(d, "src", "hot.ts"), `export const v${i} = ${i};\n`);
    g(d, ["commit", "-q", "-am", `change ${i}`], i % 2 === 0 ? "Alice" : "Bob", i);
  }
  return d;
}

describe("parseLog", () => {
  it("parses commits with numstat and binary files", () => {
    const out =
      "\x1eabc\x1fAlice\x1f2024-01-01T00:00:00Z\n\n3\t1\tsrc/a.ts\n-\t-\timg.png\n\x1edef\x1fBob\x1f2024-01-02T00:00:00Z\n\n";
    const c = parseLog(out);
    expect(c).toHaveLength(2);
    expect(c[0]?.files).toEqual([
      { path: "src/a.ts", churn: 4 },
      { path: "img.png", churn: 0 },
    ]);
    expect(c[1]?.files).toEqual([]);
  });
});

describe("collectHistory", () => {
  it("computes contributors, hotspots and ownership from a real repository", async () => {
    const d = makeRepo();
    const head = await readHead(d);
    expect(head?.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(head?.branch).toBe("main");
    expect(head?.shallow).toBe(false);
    const files = new Map<string, number | null>([
      ["src/hot.ts", 12],
      ["src/cold.ts", 1],
    ]);
    const h = await collectHistory(
      d,
      head as NonNullable<typeof head>,
      { maxCommits: 100, authors: "names", hotspotLimit: 5 },
      { files, moduleOf: () => ({ id: "m_src", path: "src" }) },
    );
    expect(h.available).toBe(true);
    expect(h.commitsAnalyzed).toBe(6);
    expect(h.contributors.map((c) => `${c.name}:${c.commits}`)).toEqual(["Alice:4", "Bob:2"]);
    expect(h.topAuthorShare).toBeCloseTo(0.667, 2);
    expect(h.hotspots[0]?.path).toBe("src/hot.ts");
    expect(h.hotspots[0]?.commits).toBe(6);
    expect(h.hotspots.find((x) => x.path === "src/cold.ts")).toBeUndefined();
    expect(h.moduleOwnership[0]?.topAuthor).toBe("Alice");
    expect(h.window.first).toContain("2024-01-01");
    expect(h.limitations.join(" ")).toMatch(/renamed/);
  });
  it("can anonymize authors", async () => {
    const d = makeRepo();
    const head = await readHead(d);
    const h = await collectHistory(
      d,
      head as NonNullable<typeof head>,
      { maxCommits: 100, authors: "anonymous", hotspotLimit: 5 },
      { files: new Map(), moduleOf: () => null },
    );
    expect(h.contributors.map((c) => c.name)).toEqual(["Author 1", "Author 2"]);
  });
  it("states that history is limited when maxCommits is reached", async () => {
    const d = makeRepo();
    const head = await readHead(d);
    const h = await collectHistory(
      d,
      head as NonNullable<typeof head>,
      { maxCommits: 3, authors: "names", hotspotLimit: 5 },
      { files: new Map(), moduleOf: () => null },
    );
    expect(h.commitsAnalyzed).toBe(3);
    expect(h.limitations[0]).toMatch(/most recent 3 commits/);
  });
  it("returns null head outside a repository", async () => {
    expect(await readHead(tmp())).toBeNull();
  });
});

describe("hardening against hostile repository configuration (SA-04)", () => {
  it("does not run a configured fsmonitor program, while an unhardened git does", async () => {
    const d = makeRepo();
    const marker = join(tmp(), "ran");
    const hook = join(tmp(), "hook.cjs");

    writeFileSync(
      hook,
      [
        'require("node:fs").writeFileSync(process.argv[2], "ran");',
        'process.stdout.write("token\\n");',
      ].join("\n"),
    );

    // Use Node.js instead of a Unix shell script so this works on Windows too.
    const hookCommand = `"${process.execPath}" "${hook}" "${marker}"`;
    g(d, ["config", "core.fsmonitor", hookCommand]);

    // Control: unhardened Git should execute the configured hook.
    execFileSync("git", ["status", "--porcelain"], {
      cwd: d,
      stdio: "ignore",
    });
    expect(existsSync(marker)).toBe(true);

    rmSync(marker);

    // Hardened Git must not execute the configured hook.
    await git(["status", "--porcelain"], d);
    await readHead(d);
    expect(existsSync(marker)).toBe(false);
  });
});

describe("exact totals", () => {
  it("counts every commit including merges, and takes contributors from the whole history", async () => {
    const d = makeRepo();
    g(d, ["switch", "-q", "-c", "feature"], "Bob", 7);
    appendFileSync(join(d, "src", "cold.ts"), "export const c = 3;\n");
    g(d, ["commit", "-q", "-am", "feature work"], "Bob", 8);
    g(d, ["switch", "-q", "main"], "Alice", 9);
    appendFileSync(join(d, "src", "hot.ts"), "export const z = 9;\n");
    g(d, ["commit", "-q", "-am", "main work"], "Alice", 10);
    g(d, ["merge", "-q", "--no-ff", "feature", "-m", "Merge pull request #1"], "Alice", 11);
    const head = await readHead(d);
    const h = await collectHistory(
      d,
      head as NonNullable<typeof head>,
      { maxCommits: 3, authors: "names", hotspotLimit: 5 },
      { files: new Map(), moduleOf: () => null },
    );
    expect(h.totalCommits).toBe(9);
    expect(h.exactTotals).toBe(true);
    expect(h.totalContributors).toBe(2);
    expect(h.commitsAnalyzed).toBe(3);
    expect(h.contributors.reduce((a, c) => a + c.commits, 0)).toBe(9);
    expect(h.limitations.join(" ")).toMatch(/most recent 3 commits of 9/);
  });
  it("detects a GitHub origin remote in https and ssh forms, and ignores others", async () => {
    const d = makeRepo();
    expect(await detectGitHubRemote(d)).toBeNull();
    let hasRemote = false;
    for (const [url, expected] of [
      ["https://github.com/acme/tool.git", { owner: "acme", repo: "tool" }],
      ["git@github.com:acme/tool.git", { owner: "acme", repo: "tool" }],
      ["https://github.com/acme/tool", { owner: "acme", repo: "tool" }],
      ["https://gitlab.com/acme/tool.git", null],
      ["https://github.com.evil.com/acme/tool.git", null],
    ] as const) {
      g(d, hasRemote ? ["remote", "set-url", "origin", url] : ["remote", "add", "origin", url]);
      hasRemote = true;
      expect(await detectGitHubRemote(d), url).toEqual(expected);
    }
  });
});
