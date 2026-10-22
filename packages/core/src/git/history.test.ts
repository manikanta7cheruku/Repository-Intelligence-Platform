import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HARDENING_FLAGS,
  buildCloneArgs,
  collectHistory,
  git,
  parseLog,
  readHead,
} from "./history.js";

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
    expect(h.limitations[0]).toMatch(/limited to the most recent 3/);
  });
  it("returns null head outside a repository", async () => {
    expect(await readHead(tmp())).toBeNull();
  });
});

describe("hardening against hostile repository configuration (SA-04)", () => {
  it("does not run a configured fsmonitor program, while an unhardened git does", async () => {
    const d = makeRepo();
    const marker = join(tmp(), "ran");
    const hook = join(tmp(), "hook.sh");
    writeFileSync(hook, `#!/bin/sh\ntouch "${marker}"\n`);
    chmodSync(hook, 0o755);
    g(d, ["config", "core.fsmonitor", hook]);
    // control: plain git status executes the hook, proving the attack vector is real
    execFileSync("git", ["status", "--porcelain"], { cwd: d, stdio: "ignore" });
    expect(existsSync(marker)).toBe(true);
    rmSync(marker);
    await git(["status", "--porcelain"], d);
    await readHead(d);
    expect(existsSync(marker)).toBe(false);
  });
  it("uses the expected hardening flags for local commands and for clones", () => {
    expect(HARDENING_FLAGS.join(" ")).toContain("core.fsmonitor=false");
    expect(HARDENING_FLAGS.join(" ")).toContain("credential.helper=");
    const clone = buildCloneArgs("https://github.com/o/r.git", "/tmp/x", 50, "main").join(" ");
    for (const must of [
      "--depth=50",
      "--no-recurse-submodules",
      "--no-checkout",
      "--template=",
      "--no-tags",
      "protocol.allow=never",
      "protocol.https.allow=always",
      "--branch=main",
      "-- https://github.com/o/r.git /tmp/x",
    ]) {
      expect(clone).toContain(must);
    }
  });
});
