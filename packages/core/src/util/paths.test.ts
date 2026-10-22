import { describe, expect, it } from "vitest";
import { dirname, extname, isSafeRelativePath, joinPosix } from "./paths.js";

describe("isSafeRelativePath", () => {
  it("accepts normal paths", () => {
    expect(isSafeRelativePath("a/b/c.ts")).toBe(true);
    expect(isSafeRelativePath("a/..b/c")).toBe(true);
  });
  it("rejects traversal, absolute and odd paths", () => {
    for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\b", "a\0b", ""]) expect(isSafeRelativePath(bad)).toBe(false);
  });
});

describe("path helpers", () => {
  it("joins and normalizes", () => {
    expect(joinPosix("a/b", "../c", "./d.ts")).toBe("a/c/d.ts");
    expect(dirname("a/b/c.ts")).toBe("a/b");
    expect(dirname("c.ts")).toBe("");
    expect(extname("a/b.TS")).toBe(".ts");
    expect(extname(".gitignore")).toBe("");
  });
});
