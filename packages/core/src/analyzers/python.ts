import type { Dependency } from "../ir/types.js";
import { dirname } from "../util/paths.js";
import {
  type AnalyzerContext,
  type AnalyzerPlugin,
  type AnalyzerResult,
  type FileAnalysis,
  throwIfAborted,
} from "./types.js";

const STDLIB = new Set(
  "abc argparse array ast asyncio atexit base64 binascii bisect builtins bz2 calendar cmath collections colorsys concurrent configparser contextlib copy copyreg csv ctypes dataclasses datetime decimal difflib dis doctest email enum errno faulthandler fcntl filecmp fnmatch fractions ftplib functools gc getopt getpass gettext glob graphlib gzip hashlib heapq hmac html http imaplib importlib inspect io ipaddress itertools json keyword linecache locale logging lzma mailbox math mimetypes mmap multiprocessing numbers operator os pathlib pickle pkgutil platform plistlib poplib pprint profile pstats pty pwd queue random re readline reprlib resource runpy sched secrets select selectors shelve shlex shutil signal site smtplib socket socketserver sqlite3 ssl stat statistics string stringprep struct subprocess sys sysconfig syslog tarfile tempfile termios textwrap threading time timeit tkinter token tokenize tomllib trace traceback tracemalloc types typing unicodedata unittest urllib uuid venv warnings wave weakref webbrowser xml xmlrpc zipapp zipfile zipimport zlib zoneinfo __future__ _thread".split(
    " ",
  ),
);

/** Replaces string contents and comments with spaces, keeping line structure so positions stay valid. */
export function stripPython(text: string): string[] {
  const out: string[] = [];
  let triple: string | null = null;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    let line = "";
    let i = 0;
    while (i < raw.length) {
      if (triple !== null) {
        const idx = raw.indexOf(triple, i);
        if (idx === -1) {
          line += " ".repeat(raw.length - i);
          i = raw.length;
        } else {
          line += " ".repeat(idx + 3 - i);
          i = idx + 3;
          triple = null;
        }
        continue;
      }
      const c = raw[i] as string;
      if (c === "#") {
        line += " ".repeat(raw.length - i);
        break;
      }
      if (raw.startsWith('"""', i) || raw.startsWith("'''", i)) {
        triple = raw.slice(i, i + 3);
        line += "   ";
        i += 3;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < raw.length && raw[j] !== c) j += raw[j] === "\\" ? 2 : 1;
        const end = Math.min(j + 1, raw.length);
        line += `${c}${" ".repeat(Math.max(0, end - i - 2))}${end - i >= 2 ? c : ""}`;
        i = end;
        continue;
      }
      line += c;
      i++;
    }
    out.push(line);
  }
  return out;
}

const indentOf = (l: string): number => l.length - l.trimStart().length;

interface PyContext {
  allPaths: Set<string>;
  roots: string[];
  topLevelNames: Set<string>;
}

function buildContext(allPaths: Set<string>): PyContext {
  const roots = new Set<string>([""]);
  for (const p of allPaths) {
    if (!p.endsWith("/__init__.py")) continue;
    let dir = dirname(p);
    while (dir !== "" && allPaths.has(`${dir}/__init__.py`)) dir = dirname(dir);
    roots.add(dir);
  }
  for (const r of ["src", "lib"]) roots.add(r);
  const rootList = [...roots].sort();
  const top = new Set<string>();
  for (const p of allPaths) {
    if (!p.endsWith(".py")) continue;
    for (const r of rootList) {
      const rel = r === "" ? p : p.startsWith(`${r}/`) ? p.slice(r.length + 1) : null;
      if (rel === null) continue;
      const first = rel.split("/")[0] as string;
      top.add(first.replace(/\.py$/, ""));
    }
  }
  return { allPaths, roots: rootList, topLevelNames: top };
}

function moduleFile(ctx: PyContext, base: string, parts: string[]): string | null {
  const rel = parts.join("/");
  const join = (x: string) => (base === "" ? x : x === "" ? base : `${base}/${x}`);
  const asFile = join(`${rel}.py`);
  if (rel !== "" && ctx.allPaths.has(asFile)) return asFile;
  const asPkg = join(rel === "" ? "__init__.py" : `${rel}/__init__.py`);
  if (ctx.allPaths.has(asPkg)) return asPkg;
  return null;
}

const isPackageInit = (p: string): boolean => p === "__init__.py" || p.endsWith("/__init__.py");

function resolveAbsolute(ctx: PyContext, parts: string[]): string | null {
  for (const root of ctx.roots) {
    const hit = moduleFile(ctx, root, parts);
    if (hit) return hit;
  }
  return null;
}

interface ImportStatement {
  line: number;
  dots: number;
  module: string;
  names: string[];
  typeOnly: boolean;
  raw: string;
}

function logicalLines(lines: string[]): { text: string; line: number; indent: number }[] {
  const out: { text: string; line: number; indent: number }[] = [];
  let buf = "";
  let start = 0;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as string;
    if (buf === "") start = i;
    const cont = l.trimEnd().endsWith("\\");
    buf += (buf === "" ? l : ` ${l.trim()}`).replace(/\\\s*$/, "");
    for (const ch of l) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    }
    if (!cont && depth === 0) {
      out.push({ text: buf, line: start + 1, indent: indentOf(lines[start] as string) });
      buf = "";
    }
  }
  if (buf !== "")
    out.push({ text: buf, line: start + 1, indent: indentOf(lines[start] as string) });
  return out;
}

export function parseImports(lines: string[]): ImportStatement[] {
  const result: ImportStatement[] = [];
  let typeIndent: number | null = null;
  for (const ll of logicalLines(lines)) {
    const t = ll.text.trim();
    if (t === "") continue;
    if (typeIndent !== null && ll.indent <= typeIndent) typeIndent = null;
    if (/^if\s+(typing\.)?TYPE_CHECKING\s*:/.test(t)) {
      typeIndent = ll.indent;
      continue;
    }
    const typeOnly = typeIndent !== null;
    let m = /^import\s+(.+)$/.exec(t);
    if (m) {
      for (const part of (m[1] as string).split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          ?.trim();
        if (name && /^[\w.]+$/.test(name))
          result.push({
            line: ll.line,
            dots: 0,
            module: name,
            names: [],
            typeOnly,
            raw: `import ${name}`,
          });
      }
      continue;
    }
    m = /^from\s+(\.*)([\w.]*)\s+import\s+(.+)$/.exec(t);
    if (m) {
      const names = (m[3] as string)
        .replace(/[()]/g, " ")
        .split(",")
        .map(
          (s) =>
            s
              .trim()
              .split(/\s+as\s+/)[0]
              ?.trim() ?? "",
        )
        .filter((s) => /^(\w+|\*)$/.test(s));
      result.push({
        line: ll.line,
        dots: (m[1] as string).length,
        module: m[2] as string,
        names,
        typeOnly,
        raw: `from ${m[1]}${m[2]} import ${names.join(", ")}`,
      });
    }
  }
  return result;
}

export function analyzePythonFile(path: string, text: string, ctx: PyContext): FileAnalysis {
  const lines = stripPython(text);
  const deps: Dependency[] = [];
  const make = (
    st: ImportStatement,
    over: Partial<Dependency> & Pick<Dependency, "resolution">,
  ): Dependency => ({
    fromPath: path,
    specifier: st.raw,
    kind: st.typeOnly ? "type-only" : "import",
    line: st.line,
    toPath: null,
    externalPackage: null,
    builtin: false,
    reason: null,
    ...over,
  });

  for (const st of parseImports(lines)) {
    const modParts = st.module === "" ? [] : st.module.split(".");
    if (st.dots > 0) {
      let base = dirname(path);
      for (let i = 1; i < st.dots; i++) base = dirname(base);
      const target = moduleFile(ctx, base, modParts);
      const subs: string[] = [];
      for (const n of st.names) {
        if (n === "*") continue;
        const sub = moduleFile(ctx, base, [...modParts, n]);
        if (sub && sub !== target) subs.push(sub);
      }
      for (const s of [...new Set(subs)])
        deps.push(make(st, { resolution: "resolved", toPath: s }));
      // Importing from a package also runs the package's __init__.py, so it is a dependency too.
      if (target && target !== path && (subs.length === 0 || isPackageInit(target)))
        deps.push(make(st, { resolution: "resolved", toPath: target }));
      if (subs.length === 0 && !target)
        deps.push(
          make(st, { resolution: "unresolved", reason: "relative module not found in repository" }),
        );
      continue;
    }
    const top = modParts[0] as string;
    if (STDLIB.has(top) && !ctx.topLevelNames.has(top)) {
      deps.push(make(st, { resolution: "external", externalPackage: top, builtin: true }));
      continue;
    }
    const target = resolveAbsolute(ctx, modParts);
    const subs: string[] = [];
    for (const n of st.names) {
      if (n === "*") continue;
      const sub = resolveAbsolute(ctx, [...modParts, n]);
      if (sub && sub !== target) subs.push(sub);
    }
    // A directory without __init__.py is a namespace package: its modules can still be imported by name.
    if (target || subs.length > 0) {
      for (const s of [...new Set(subs)])
        deps.push(make(st, { resolution: "resolved", toPath: s }));
      if (target && target !== path && (subs.length === 0 || isPackageInit(target)))
        deps.push(make(st, { resolution: "resolved", toPath: target }));
    } else if (ctx.topLevelNames.has(top)) {
      deps.push(
        make(st, { resolution: "unresolved", reason: "submodule not found in repository package" }),
      );
    } else {
      deps.push(make(st, { resolution: "external", externalPackage: top }));
    }
  }

  const symbols: FileAnalysis["symbols"] = [];
  const defs: { name: string; line: number; indent: number; cls: string | null }[] = [];
  let currentClass: { name: string; indent: number } | null = null;
  lines.forEach((l, i) => {
    if (l.trim() === "") return;
    const ind = indentOf(l);
    if (currentClass && ind <= currentClass.indent) currentClass = null;
    const m = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/.exec(l);
    const c = /^\s*class\s+(\w+)/.exec(l);
    if (c) {
      if (ind === 0)
        symbols.push({
          name: c[1] as string,
          kind: "class",
          exported: !(c[1] as string).startsWith("_"),
          line: i + 1,
          endLine: i + 1,
        });
      currentClass = { name: c[1] as string, indent: ind };
    }
    if (m) {
      const cls: string | null =
        currentClass && ind > currentClass.indent ? currentClass.name : null;
      defs.push({ name: m[1] as string, line: i + 1, indent: ind, cls });
      if (ind === 0)
        symbols.push({
          name: m[1] as string,
          kind: "function",
          exported: !(m[1] as string).startsWith("_"),
          line: i + 1,
          endLine: i + 1,
        });
    }
  });
  const lastNonBlank = (from: number, indent: number): number => {
    let end = from;
    for (let i = from; i < lines.length; i++) {
      const l = lines[i] as string;
      if (l.trim() === "") continue;
      if (indentOf(l) <= indent) break;
      end = i + 1;
    }
    return end;
  };
  for (const s of symbols) s.endLine = lastNonBlank(s.line, 0) || s.line;

  const functions: FileAnalysis["functions"] = defs.map((d) => {
    const end = lastNonBlank(d.line, d.indent);
    const nested = defs.filter(
      (o) => o !== d && o.line > d.line && o.line <= end && o.indent > d.indent,
    );
    let count = 1;
    for (let ln = d.line + 1; ln <= end; ln++) {
      if (nested.some((o) => ln >= o.line && ln <= lastNonBlank(o.line, o.indent))) continue;
      const l = lines[ln - 1] as string;
      count += (l.match(/\b(if|elif|for|while|except|case|and|or)\b/g) ?? []).length;
    }
    return {
      name: d.cls ? `${d.cls}.${d.name}` : d.name,
      line: d.line,
      endLine: Math.max(end, d.line),
      complexity: count,
      approximate: true,
    };
  });
  return { path, dependencies: deps, symbols, functions, dynamicUnresolved: 0, parseError: null };
}

export const pythonAnalyzer: AnalyzerPlugin = {
  id: "python",
  version: "0.1.0",
  languages: ["python"],
  supportLevel: 2,
  capabilities: ["imports", "symbols", "resolution", "complexity"],
  limitations: [
    "Import extraction is lexical (strings and comments are ignored) and is not a full Python parser.",
    "Dynamic imports (importlib, __import__) are not detected.",
    "Imports that match neither the standard library nor a repository package are assumed to be third-party packages.",
    "Source roots are inferred from package layout (__init__.py), src and lib directories.",
    "Complexity is an approximation from decision keywords, not an AST measurement.",
    "Only top-level functions and classes are listed as symbols.",
  ],
  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const py = buildContext(ctx.allPaths);
    const files: FileAnalysis[] = [];
    let n = 0;
    for (const f of ctx.files) {
      if ((n++ & 63) === 0) throwIfAborted(ctx.signal);
      const text = ctx.ws.read(f.path);
      files.push(
        text === null
          ? {
              path: f.path,
              dependencies: [],
              symbols: [],
              functions: [],
              dynamicUnresolved: 0,
              parseError: "file unreadable or over the per-file size budget",
            }
          : analyzePythonFile(f.path, text, py),
      );
    }
    return { files, limitations: pythonAnalyzer.limitations };
  },
};
