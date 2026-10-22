import { describe, expect, it } from "vitest";
import { resolveConfig } from "../config/config.js";
import type { Workspace } from "../acquire/types.js";
import { JsResolver, analyzeJsTsFile, packageNameOf } from "./js-ts.js";

function fakeWs(files: Record<string, string>): { ws: Workspace; all: Set<string> } {
  const all = new Set(Object.keys(files));
  const ws: Workspace = {
    root: "/virtual",
    files: [...all].map((path) => ({
      path,
      bytes: (files[path] as string).length,
      absPath: `/virtual/${path}`,
    })),
    read: (p) => files[p] ?? null,
    has: (p) => all.has(p),
    excluded: [],
    truncated: false,
    limitations: [],
  };
  return { ws, all };
}
const analyze = (files: Record<string, string>, path: string) => {
  const { ws, all } = fakeWs(files);
  void resolveConfig({});
  return analyzeJsTsFile(path, files[path] as string, new JsResolver(ws, all));
};
const kinds = (r: ReturnType<typeof analyze>) =>
  r.dependencies.map((d) => `${d.kind}:${d.specifier}:${d.resolution}`);

describe("import extraction", () => {
  it("classifies every import form", () => {
    const r = analyze(
      {
        "a.ts": [
          'import x from "./b";',
          'import type { T } from "./b";',
          'import { type U } from "./b";',
          'import { v, type W } from "./b";',
          'export * from "./b";',
          'export type { T } from "./b";',
          'import fs = require("fs");',
          'const r = require("./b");',
          'const d = import("./b");',
          'type Z = import("./b").T;',
          'import "./b";',
        ].join("\n"),
        "b.ts": "export const v = 1; export type T = number;",
      },
      "a.ts",
    );
    expect(kinds(r)).toEqual([
      "import:./b:resolved",
      "type-only:./b:resolved",
      "type-only:./b:resolved",
      "import:./b:resolved",
      "reexport:./b:resolved",
      "type-only:./b:resolved",
      "require:fs:external",
      "require:./b:resolved",
      "dynamic:./b:resolved",
      "type-only:./b:resolved",
      "import:./b:resolved",
    ]);
  });
  it("counts non-literal dynamic imports and requires instead of guessing", () => {
    const r = analyze({ "a.ts": "const n = 'x'; import(n); require(n + 'y');" }, "a.ts");
    expect(r.dependencies).toHaveLength(0);
    expect(r.dynamicUnresolved).toBe(2);
  });
  it("reports line numbers", () => {
    const r = analyze({ "a.ts": '\n\nimport x from "./b";', "b.ts": "export default 1;" }, "a.ts");
    expect(r.dependencies[0]?.line).toBe(3);
  });
  it("marks builtins and scoped packages as external with the right package name", () => {
    const r = analyze(
      {
        "a.ts":
          'import a from "node:fs/promises"; import b from "@scope/pkg/sub"; import c from "lodash/fp"; import d from "path";',
      },
      "a.ts",
    );
    expect(r.dependencies.map((d) => `${d.externalPackage}:${d.builtin}`)).toEqual([
      "fs:true",
      "@scope/pkg:false",
      "lodash:false",
      "path:true",
    ]);
    expect(packageNameOf("@scope/pkg/sub")).toBe("@scope/pkg");
  });
  it("maps a .js specifier to the .ts source and resolves directory index files", () => {
    const r = analyze(
      {
        "a.ts": 'import "./b.js"; import "./dir";',
        "b.ts": "export {};",
        "dir/index.ts": "export {};",
      },
      "a.ts",
    );
    expect(r.dependencies.map((d) => d.toPath)).toEqual(["b.ts", "dir/index.ts"]);
  });
  it("reports a missing relative module as unresolved with a reason", () => {
    const r = analyze({ "a.ts": 'import "./nope";' }, "a.ts");
    expect(r.dependencies[0]).toMatchObject({
      resolution: "unresolved",
      reason: "relative module not found in repository",
    });
  });
  it("ignores URL specifiers", () => {
    const r = analyze({ "a.ts": 'import "https://cdn.example.com/x.js";' }, "a.ts");
    expect(r.dependencies[0]?.resolution).toBe("ignored");
  });
});

describe("symbols and exports", () => {
  it("lists top level symbols with export status including export lists", () => {
    const r = analyze(
      {
        "a.ts": [
          "export function f() {}",
          "class C {}",
          "interface I {}",
          "export type T = 1;",
          "enum E { A }",
          "export const g = () => 1;",
          "const h = 2;",
          "export { C };",
          "export default h;",
        ].join("\n"),
      },
      "a.ts",
    );
    const view = r.symbols.map((s) => `${s.name}:${s.kind}:${s.exported}`);
    expect(view).toEqual([
      "f:function:true",
      "C:class:true",
      "I:interface:false",
      "T:type:true",
      "E:enum:false",
      "g:function:true",
      "h:variable:true",
    ]);
  });
});

describe("complexity", () => {
  const cx = (code: string) => analyze({ "a.ts": code }, "a.ts").functions;
  it("is 1 for a straight line function", () => {
    expect(cx("function f() { return 1; }")[0]?.complexity).toBe(1);
  });
  it("counts branches, loops, cases, catch, ternary and logical operators", () => {
    const code = `function f(a: number, b: number) {
      if (a && b) { return 1; } else if (a || b) { return 2; }
      for (let i = 0; i < a; i++) { while (b) { b--; } }
      for (const x of [1]) { void x; }
      switch (a) { case 1: return 3; case 2: return 4; default: return 5; }
      try { f(1, 2); } catch (e) { void e; }
      return a ? b ?? 1 : 0;
    }`;
    // 1 + if + && + else-if + || + for + while + for-of + 2 cases + catch + ternary + ??
    expect(cx(code)[0]?.complexity).toBe(13);
  });
  it("does not add nested function complexity to the outer function", () => {
    const fns = cx(
      "function outer() { const inner = () => { if (1) { return 1; } return 2; }; return inner; }",
    );
    expect(fns.map((f) => `${f.name}:${f.complexity}`).sort()).toEqual(["inner:2", "outer:1"]);
  });
  it("names methods with their class and handles anonymous functions", () => {
    const fns = cx(
      "class A { m() { return 1; } constructor() {} } export default function () { return 1; }",
    );
    expect(fns.map((f) => f.name).sort()).toEqual(["<anonymous>", "A.constructor", "A.m"]);
  });
});

describe("robustness", () => {
  it("reports syntax errors but still extracts what it can", () => {
    const r = analyze({ "a.ts": 'import "./b";\nexport const = ;', "b.ts": "" }, "a.ts");
    expect(r.parseError).toMatch(/syntax error/);
    expect(r.dependencies).toHaveLength(1);
  });
  it("handles an empty file and a JSX file", () => {
    expect(analyze({ "a.ts": "" }, "a.ts").dependencies).toEqual([]);
    expect(
      analyze({ "a.tsx": 'import x from "react"; export const A = () => <div>{x}</div>;' }, "a.tsx")
        .dependencies,
    ).toHaveLength(1);
  });
});
