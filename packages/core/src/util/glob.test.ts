import { describe, expect, it } from "vitest";
import { GlobSet, globToRegExp } from "./glob.js";

describe("globToRegExp", () => {
  it("matches directory wildcards", () => {
    const g = new GlobSet(["src/ui/**"]);
    expect(g.matches("src/ui/a.ts")).toBe(true);
    expect(g.matches("src/ui/deep/b.ts")).toBe(true);
    expect(g.matches("src/domain/a.ts")).toBe(false);
    expect(g.matches("other/src/ui/a.ts")).toBe(false);
  });
  it("treats a pattern without slash as a basename match at any depth", () => {
    const g = new GlobSet(["*.test.ts"]);
    expect(g.matches("a.test.ts")).toBe(true);
    expect(g.matches("src/deep/a.test.ts")).toBe(true);
    expect(g.matches("src/a.ts")).toBe(false);
  });
  it("supports leading double star and braces", () => {
    expect(globToRegExp("**/dist/**").test("packages/core/dist/index.js")).toBe(true);
    expect(globToRegExp("**/dist/**").test("dist/index.js")).toBe(true);
    expect(globToRegExp("src/*.{ts,tsx}").test("src/a.tsx")).toBe(true);
    expect(globToRegExp("src/*.{ts,tsx}").test("src/a.js")).toBe(false);
  });
  it("does not let a single star cross directories", () => {
    expect(globToRegExp("src/*.ts").test("src/a/b.ts")).toBe(false);
  });
  it("escapes regex metacharacters", () => {
    expect(globToRegExp("a+b.ts").test("a+b.ts")).toBe(true);
    expect(globToRegExp("a+b.ts").test("aab.ts")).toBe(false);
  });
});
