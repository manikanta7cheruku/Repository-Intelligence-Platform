import { describe, expect, it } from "vitest";
import { analyzePythonFile, parseImports, stripPython } from "./python.js";

const ctx = (paths: string[]) => ({
  allPaths: new Set(paths),
  roots: ["", "src"],
  topLevelNames: new Set(
    paths.map(
      (p) => (p.startsWith("src/") ? p.slice(4) : p).split("/")[0]?.replace(/\.py$/, "") as string,
    ),
  ),
});
const view = (text: string, paths: string[], from = "pkg/a.py") =>
  analyzePythonFile(from, text, ctx(paths)).dependencies.map(
    (d) => `${d.kind}:${d.specifier}:${d.resolution}:${d.toPath ?? d.externalPackage}`,
  );

describe("stripPython", () => {
  it("blanks strings and comments but keeps line count", () => {
    const out = stripPython('x = "import os"  # import sys\n"""\nimport json\n"""\ny = 1');
    expect(out).toHaveLength(5);
    expect(out.join("\n")).not.toMatch(/import (os|sys|json)/);
    expect(out[4]).toBe("y = 1");
  });
});

describe("parseImports", () => {
  it("handles multiline parentheses, aliases and backslash continuation", () => {
    const lines = stripPython(
      "from a import (\n    b,\n    c as d,\n)\nimport x.y as z, w\nfrom q import \\\n    r",
    );
    const parsed = parseImports(lines);
    expect(parsed.map((p) => `${p.module}:${p.names.join("+")}`)).toEqual([
      "a:b+c",
      "x.y:",
      "w:",
      "q:r",
    ]);
  });
  it("marks imports under TYPE_CHECKING as type-only and resets afterwards", () => {
    const parsed = parseImports(stripPython("if TYPE_CHECKING:\n    import a\nimport b\n"));
    expect(parsed.map((p) => `${p.module}:${p.typeOnly}`)).toEqual(["a:true", "b:false"]);
  });
});

describe("resolution", () => {
  const paths = [
    "pkg/__init__.py",
    "pkg/a.py",
    "pkg/b.py",
    "pkg/sub/__init__.py",
    "pkg/sub/c.py",
    "src/lib/__init__.py",
    "src/lib/tools.py",
  ];
  it("resolves absolute, relative and package imports", () => {
    expect(
      view(
        "import pkg.b\nfrom pkg import b\nfrom . import b\nfrom .sub import c\nfrom .sub.c import f",
        paths,
      ),
    ).toEqual([
      "import:import pkg.b:resolved:pkg/b.py",
      "import:from pkg import b:resolved:pkg/b.py",
      "import:from pkg import b:resolved:pkg/__init__.py",
      "import:from . import b:resolved:pkg/b.py",
      "import:from . import b:resolved:pkg/__init__.py",
      "import:from .sub import c:resolved:pkg/sub/c.py",
      "import:from .sub import c:resolved:pkg/sub/__init__.py",
      "import:from .sub.c import f:resolved:pkg/sub/c.py",
    ]);
  });
  it("finds modules under a src root", () => {
    expect(view("import lib.tools", paths)).toEqual([
      "import:import lib.tools:resolved:src/lib/tools.py",
    ]);
  });
  it("classifies stdlib, third party and missing repository submodules", () => {
    const r = view("import os\nimport requests\nimport pkg.missing\nfrom .nothing import z", paths);
    expect(r).toEqual([
      "import:import os:external:os",
      "import:import requests:external:requests",
      "import:import pkg.missing:unresolved:null",
      "import:from .nothing import z:unresolved:null",
    ]);
  });
  it("lets a repository module shadow a stdlib name", () => {
    expect(view("import json", ["json.py", "pkg/a.py"])).toEqual([
      "import:import json:resolved:json.py",
    ]);
  });
});

describe("symbols and complexity", () => {
  it("finds top level defs and approximates complexity per function excluding nested defs", () => {
    const r = analyzePythonFile(
      "m.py",
      "class A:\n    def m(self, x):\n        if x and x > 1:\n            return 1\n        return 2\n\ndef top(a):\n    def inner(b):\n        if b:\n            return 1\n        return 0\n    for i in a:\n        pass\n    return inner\n",
      ctx(["m.py"]),
    );
    expect(r.symbols.map((s) => `${s.name}:${s.kind}`)).toEqual(["A:class", "top:function"]);
    const byName = Object.fromEntries(r.functions.map((f) => [f.name, f.complexity]));
    expect(byName).toEqual({ "A.m": 3, top: 2, inner: 2 });
    expect(r.functions.every((f) => f.approximate)).toBe(true);
  });
});

describe("package imports", () => {
  it("treats a directory without __init__.py as a namespace package whose modules can be imported by name", () => {
    expect(
      view("from utils import helper\nimport utils.other\n", ["utils/helper.py", "utils/other.py"]),
    ).toEqual([
      "import:from utils import helper:resolved:utils/helper.py",
      "import:import utils.other:resolved:utils/other.py",
    ]);
  });
  it("adds the package __init__.py as a dependency, because importing from a package runs it", () => {
    const paths = ["lib2/__init__.py", "lib2/sub.py", "lib2/other.py"];
    expect(view("from lib2 import sub\n", paths, "app.py")).toEqual([
      "import:from lib2 import sub:resolved:lib2/sub.py",
      "import:from lib2 import sub:resolved:lib2/__init__.py",
    ]);
    expect(view("from . import other\n", paths, "lib2/sub.py")).toEqual([
      "import:from . import other:resolved:lib2/other.py",
      "import:from . import other:resolved:lib2/__init__.py",
    ]);
  });
  it("does not make a package depend on itself", () => {
    const paths = ["pkg3/__init__.py", "pkg3/sub.py"];
    const deps = view("from . import sub\n", paths, "pkg3/__init__.py");
    expect(deps).toEqual(["import:from . import sub:resolved:pkg3/sub.py"]);
  });
});
