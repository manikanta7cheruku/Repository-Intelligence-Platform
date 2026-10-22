import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import { AcquisitionError, openLocalWorkspace } from "./local.js";

let dirs: string[] = [];
const make = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), "rl-local-"));
  dirs.push(d);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
const cfg = resolveConfig({});

describe("openLocalWorkspace", () => {
  it("lists files in sorted order and skips node_modules and .git with a recorded reason", () => {
    const d = make({
      "b.ts": "1",
      "a.ts": "2",
      "node_modules/x/index.js": "3",
      ".git/config": "4",
      "src/c.ts": "5",
    });
    const ws = openLocalWorkspace(d, cfg);
    expect(ws.files.map((f) => f.path)).toEqual(["a.ts", "b.ts", "src/c.ts"]);
    expect(ws.excluded.map((e) => e.reason)).toEqual([
      "directory excluded: dependency directory",
      "directory excluded: git metadata",
    ]);
  });
  it("does not follow symbolic links", () => {
    const d = make({ "real.ts": "x" });
    const outside = make({ "secret.txt": "top secret" });
    symlinkSync(join(outside, "secret.txt"), join(d, "link.txt"));
    symlinkSync(outside, join(d, "linkdir"));
    const ws = openLocalWorkspace(d, cfg);
    expect(ws.files.map((f) => f.path)).toEqual(["real.ts"]);
    expect(ws.excluded[0]?.reason).toBe("symbolic link (not followed)");
    expect(ws.excluded[0]?.count).toBe(2);
  });
  it("truncates at the file budget and says so", () => {
    const d = make(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}.ts`, "x"])));
    const ws = openLocalWorkspace(d, resolveConfig({ budgets: { maxFiles: 4 } }));
    expect(ws.files).toHaveLength(4);
    expect(ws.truncated).toBe(true);
    expect(ws.limitations[0]).toMatch(/truncated/);
  });
  it("refuses to read files over the per-file budget", () => {
    const d = make({ "big.ts": "x".repeat(2000), "small.ts": "y" });
    const ws = openLocalWorkspace(d, resolveConfig({ budgets: { maxFileBytes: 100 } }));
    expect(ws.read("big.ts")).toBeNull();
    expect(ws.read("small.ts")).toBe("y");
  });
  it("applies user exclusion globs", () => {
    const d = make({ "keep.ts": "1", "gen/out.ts": "2", "a.snap": "3" });
    const ws = openLocalWorkspace(d, resolveConfig({ exclude: ["gen/**", "*.snap"] }));
    expect(ws.files.map((f) => f.path)).toEqual(["keep.ts"]);
  });
  it("errors clearly for missing paths and files", () => {
    expect(() => openLocalWorkspace("/definitely/not/here", cfg)).toThrow(AcquisitionError);
    const d = make({ "f.ts": "x" });
    expect(() => openLocalWorkspace(join(d, "f.ts"), cfg)).toThrow(/Not a directory/);
  });
});
