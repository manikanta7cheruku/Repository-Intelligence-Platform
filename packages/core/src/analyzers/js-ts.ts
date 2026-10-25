import { builtinModules } from "node:module";
import ts from "typescript";
import type { Workspace } from "../acquire/types.js";
import { type PackageJson, readPackageJson } from "../detect/manifests.js";
import type { Symbol as AnalyzedSymbol, Dependency, DependencyKind } from "../ir/types.js";
import { basename, dirname, joinPosix } from "../util/paths.js";
import {
  type AnalyzerContext,
  type AnalyzerPlugin,
  type AnalyzerResult,
  type FileAnalysis,
  throwIfAborted,
} from "./types.js";

const VROOT = "/r";
const CODE_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));

export function packageNameOf(spec: string): string {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0] as string;
}

interface WorkspacePackage {
  name: string;
  dir: string;
  pkg: PackageJson;
}

interface Resolved {
  resolution: Dependency["resolution"];
  toPath: string | null;
  externalPackage: string | null;
  builtin: boolean;
  reason: string | null;
}

/** Resolves import specifiers using the TypeScript module resolver over an in-memory view of the repository. */
export class JsResolver {
  private readonly dirs = new Set<string>([""]);
  private readonly optionsCache = new Map<
    string,
    { options: ts.CompilerOptions; pathKeys: string[]; cache: ts.ModuleResolutionCache }
  >();
  private readonly packages: WorkspacePackage[] = [];
  readonly host: ts.ModuleResolutionHost;
  readonly configNotes = new Set<string>();

  constructor(
    private readonly ws: Workspace,
    private readonly allPaths: Set<string>,
  ) {
    for (const p of allPaths) {
      let d = dirname(p);
      while (d !== "" && !this.dirs.has(d)) {
        this.dirs.add(d);
        d = dirname(d);
      }
    }
    for (const p of allPaths) {
      if (basename(p) !== "package.json") continue;
      const pkg = readPackageJson(ws, p);
      if (pkg?.name) this.packages.push({ name: pkg.name, dir: dirname(p), pkg });
    }
    const strip = (p: string) =>
      p === VROOT ? "" : p.startsWith(`${VROOT}/`) ? p.slice(VROOT.length + 1) : null;
    this.host = {
      fileExists: (p) => {
        const rel = strip(p);
        return rel !== null && this.allPaths.has(rel);
      },
      readFile: (p) => {
        const rel = strip(p);
        return rel === null ? undefined : (this.ws.read(rel) ?? undefined);
      },
      directoryExists: (p) => {
        const rel = strip(p);
        return rel !== null && this.dirs.has(rel);
      },
      realpath: (p) => p,
      getCurrentDirectory: () => VROOT,
      useCaseSensitiveFileNames: true,
    };
  }

  private configFor(fromPath: string) {
    let dir = dirname(fromPath);
    for (;;) {
      for (const name of ["tsconfig.json", "jsconfig.json"]) {
        const candidate = dir === "" ? name : `${dir}/${name}`;
        if (this.allPaths.has(candidate)) return this.loadConfig(candidate);
      }
      if (dir === "") break;
      dir = dirname(dir);
    }
    return this.loadConfig(null);
  }

  private loadConfig(path: string | null) {
    const key = path ?? "<default>";
    const cached = this.optionsCache.get(key);
    if (cached) return cached;
    let options: ts.CompilerOptions = {};
    if (path) {
      const read = ts.readConfigFile(`${VROOT}/${path}`, (p) => this.host.readFile(p));
      if (read.config) {
        const parsed = ts.parseJsonConfigFileContent(
          read.config,
          {
            useCaseSensitiveFileNames: true,
            readDirectory: () => [],
            fileExists: (p) => this.host.fileExists(p),
            readFile: (p) => this.host.readFile(p),
          },
          `${VROOT}/${dirname(path)}`.replace(/\/$/, ""),
        );
        options = parsed.options;
        if (parsed.errors.length > 0)
          this.configNotes.add(
            `${path}: ${parsed.errors.length} configuration diagnostics (for example an extends target that is not in the repository)`,
          );
      } else {
        this.configNotes.add(`${path}: could not be parsed`);
      }
    }
    const resolutionKind = options.moduleResolution;
    if (resolutionKind === undefined || resolutionKind === ts.ModuleResolutionKind.Classic) {
      options = {
        ...options,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
      };
    }
    options = { ...options, allowJs: true, resolveJsonModule: true, noEmit: true };
    const pathKeys = Object.keys(options.paths ?? {});
    const cache = ts.createModuleResolutionCache(VROOT, (f) => f, options);
    const value = { options, pathKeys, cache };
    this.optionsCache.set(key, value);
    return value;
  }

  private toRepoPath(abs: string): string | null {
    if (!abs.startsWith(`${VROOT}/`)) return null;
    const rel = abs.slice(VROOT.length + 1);
    return this.allPaths.has(rel) ? rel : null;
  }

  private pathAliasMatches(keys: string[], spec: string): boolean {
    return keys.some((k) =>
      k.includes("*")
        ? spec.startsWith(k.slice(0, k.indexOf("*"))) && spec.endsWith(k.slice(k.indexOf("*") + 1))
        : k === spec,
    );
  }

  private tryFile(base: string): string | null {
    const stripped = base.replace(/\.(m|c)?js$/, "");
    const variants = [
      base,
      ...CODE_EXTS.map((e) => `${base}${e}`),
      ...CODE_EXTS.map((e) => `${stripped}${e}`),
      ...CODE_EXTS.map((e) => `${base}/index${e}`),
    ];
    return variants.find((v) => this.allPaths.has(v)) ?? null;
  }

  private workspaceEntry(wp: WorkspacePackage, subpath: string): string | null {
    const dir = wp.dir;
    const at = (p: string) => joinPosix(dir, p);
    if (subpath !== "") {
      return this.tryFile(at(subpath)) ?? this.tryFile(at(`src/${subpath}`));
    }
    const candidates: string[] = [];
    const exp = wp.pkg.exports;
    const collect = (v: unknown): void => {
      if (typeof v === "string") candidates.push(v);
      else if (v && typeof v === "object") for (const x of Object.values(v)) collect(x);
    };
    if (typeof exp === "string") collect(exp);
    else if (exp && typeof exp === "object") collect((exp as Record<string, unknown>)["."] ?? exp);
    for (const f of [wp.pkg.types, wp.pkg.module, wp.pkg.main])
      if (typeof f === "string") candidates.push(f);
    for (const c of candidates) {
      const clean = c.replace(/^\.\//, "");
      const hit =
        this.tryFile(at(clean)) ?? this.tryFile(at(clean.replace(/^(dist|build|lib)\//, "src/")));
      if (hit) return hit;
    }
    return this.tryFile(at("src/index")) ?? this.tryFile(at("index"));
  }

  resolve(spec: string, fromPath: string): Resolved {
    if (/^(https?:|data:|file:)/.test(spec)) {
      return {
        resolution: "ignored",
        toPath: null,
        externalPackage: null,
        builtin: false,
        reason: "URL specifier",
      };
    }
    const bare = !spec.startsWith(".") && !spec.startsWith("/");
    if (bare) {
      const bareName = spec.replace(/^node:/, "");
      if (spec.startsWith("node:") || BUILTINS.has(bareName.split("/")[0] as string)) {
        if (
          spec.startsWith("node:") ||
          !this.packages.some((p) => p.name === packageNameOf(spec))
        ) {
          return {
            resolution: "external",
            toPath: null,
            externalPackage: bareName.split("/")[0] as string,
            builtin: true,
            reason: null,
          };
        }
      }
    }
    const cfg = this.configFor(fromPath);
    const result = ts.resolveModuleName(
      spec,
      `${VROOT}/${fromPath}`,
      cfg.options,
      this.host,
      cfg.cache,
    );
    const hit =
      result.resolvedModule && !result.resolvedModule.isExternalLibraryImport
        ? this.toRepoPath(result.resolvedModule.resolvedFileName)
        : null;
    if (hit)
      return {
        resolution: "resolved",
        toPath: hit,
        externalPackage: null,
        builtin: false,
        reason: null,
      };
    if (!bare) {
      const joined = spec.startsWith("/") ? spec.slice(1) : joinPosix(dirname(fromPath), spec);
      const fallback = this.tryFile(joined);
      if (fallback)
        return {
          resolution: "resolved",
          toPath: fallback,
          externalPackage: null,
          builtin: false,
          reason: null,
        };
      return {
        resolution: "unresolved",
        toPath: null,
        externalPackage: null,
        builtin: false,
        reason: "relative module not found in repository",
      };
    }
    const pkgName = packageNameOf(spec);
    const wp = this.packages.find((p) => p.name === pkgName);
    if (wp) {
      const sub = spec.slice(pkgName.length + 1);
      const entry = this.workspaceEntry(wp, sub);
      if (entry)
        return {
          resolution: "resolved",
          toPath: entry,
          externalPackage: null,
          builtin: false,
          reason: `workspace package ${pkgName}`,
        };
      return {
        resolution: "unresolved",
        toPath: null,
        externalPackage: null,
        builtin: false,
        reason: `workspace package ${pkgName} entry not found`,
      };
    }
    if (this.pathAliasMatches(cfg.pathKeys, spec)) {
      return {
        resolution: "unresolved",
        toPath: null,
        externalPackage: null,
        builtin: false,
        reason: "path alias target not found",
      };
    }
    return {
      resolution: "external",
      toPath: null,
      externalPackage: pkgName,
      builtin: false,
      reason: null,
    };
  }
}

function scriptKindFor(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const hasExportModifier = (n: ts.Node): boolean =>
  ts.canHaveModifiers(n) &&
  (ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false);
const hasDefaultModifier = (n: ts.Node): boolean =>
  ts.canHaveModifiers(n) &&
  (ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false);

function isFunctionLike(n: ts.Node): n is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  );
}

/** Decision point count for one function body, not descending into nested functions. */
export function cyclomaticComplexity(fn: ts.FunctionLikeDeclaration): number {
  let count = 1;
  const visit = (n: ts.Node): void => {
    if (n !== fn && isFunctionLike(n)) return;
    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.ConditionalExpression:
        count++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const op = (n as ts.BinaryExpression).operatorToken.kind;
        if (
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken ||
          op === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
          op === ts.SyntaxKind.BarBarEqualsToken ||
          op === ts.SyntaxKind.QuestionQuestionEqualsToken
        )
          count++;
        break;
      }
      default:
        break;
    }
    ts.forEachChild(n, visit);
  };
  if (fn.body) ts.forEachChild(fn.body, visit);
  return count;
}

function functionName(fn: ts.FunctionLikeDeclaration, sf: ts.SourceFile): string {
  if (ts.isConstructorDeclaration(fn)) return `${className(fn.parent) ?? "<class>"}.constructor`;
  if (
    (ts.isMethodDeclaration(fn) ||
      ts.isGetAccessorDeclaration(fn) ||
      ts.isSetAccessorDeclaration(fn)) &&
    fn.name
  ) {
    const cls = className(fn.parent);
    return cls ? `${cls}.${fn.name.getText(sf)}` : fn.name.getText(sf);
  }
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) return fn.name.text;
  const p = fn.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
  if (p && ts.isPropertyDeclaration(p)) return p.name.getText(sf);
  if (p && ts.isCallExpression(p) && p.arguments.includes(fn as ts.Expression)) {
    const callee = p.expression.getText(sf).replace(/\s+/g, " ");
    return `${callee.length > 40 ? `${callee.slice(0, 37)}...` : callee}() callback`;
  }
  if (p && ts.isExportAssignment(p)) return "default export";
  return "<anonymous>";
}

function className(n: ts.Node): string | null {
  return (ts.isClassDeclaration(n) || ts.isClassExpression(n)) && n.name ? n.name.text : null;
}

export function analyzeJsTsFile(path: string, text: string, resolver: JsResolver): FileAnalysis {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindFor(path));
  const deps: Dependency[] = [];
  const symbols: FileAnalysis["symbols"] = [];
  const functions: FileAnalysis["functions"] = [];
  let dynamicUnresolved = 0;
  const syntaxErrors =
    (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics?.length ?? 0;
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const endLine = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;

  const addDep = (spec: string, kind: DependencyKind, at: ts.Node) => {
    const r = resolver.resolve(spec, path);
    deps.push({
      fromPath: path,
      specifier: spec,
      kind,
      line: line(at),
      resolution: r.resolution,
      toPath: r.toPath,
      externalPackage: r.externalPackage,
      builtin: r.builtin,
      reason: r.reason,
    });
  };

  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const clause = n.importClause;
      let typeOnly = clause?.isTypeOnly ?? false;
      if (
        clause &&
        !typeOnly &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings)
      ) {
        const els = clause.namedBindings.elements;
        typeOnly = els.length > 0 && els.every((e) => e.isTypeOnly);
      }
      addDep(n.moduleSpecifier.text, typeOnly ? "type-only" : "import", n);
    } else if (
      ts.isExportDeclaration(n) &&
      n.moduleSpecifier &&
      ts.isStringLiteral(n.moduleSpecifier)
    ) {
      addDep(n.moduleSpecifier.text, n.isTypeOnly ? "type-only" : "reexport", n);
    } else if (
      ts.isImportEqualsDeclaration(n) &&
      ts.isExternalModuleReference(n.moduleReference) &&
      ts.isStringLiteral(n.moduleReference.expression)
    ) {
      addDep(n.moduleReference.expression.text, n.isTypeOnly ? "type-only" : "require", n);
    } else if (ts.isCallExpression(n)) {
      const arg = n.arguments[0];
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (arg && ts.isStringLiteralLike(arg)) addDep(arg.text, "dynamic", n);
        else dynamicUnresolved++;
      } else if (
        ts.isIdentifier(n.expression) &&
        n.expression.text === "require" &&
        n.arguments.length === 1
      ) {
        if (arg && ts.isStringLiteralLike(arg)) addDep(arg.text, "require", n);
        else dynamicUnresolved++;
      }
    } else if (
      ts.isImportTypeNode(n) &&
      ts.isLiteralTypeNode(n.argument) &&
      ts.isStringLiteral(n.argument.literal)
    ) {
      addDep(n.argument.literal.text, "type-only", n);
    }
    if (isFunctionLike(n) && n.body) {
      functions.push({
        name: functionName(n, sf),
        line: line(n),
        endLine: endLine(n),
        complexity: cyclomaticComplexity(n),
        approximate: false,
      });
    }
    ts.forEachChild(n, visit);
  };

  const exportedNames = new Set<string>();
  const collectExports = (stmt: ts.Statement) => {
    if (
      ts.isExportDeclaration(stmt) &&
      !stmt.moduleSpecifier &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      for (const el of stmt.exportClause.elements)
        exportedNames.add((el.propertyName ?? el.name).text);
    }
    if (ts.isExportAssignment(stmt) && ts.isIdentifier(stmt.expression))
      exportedNames.add(stmt.expression.text);
  };

  const topLevel = (stmt: ts.Statement) => {
    const exported = hasExportModifier(stmt);
    const push = (
      name: string,
      kind: Omit<AnalyzedSymbol, "fileId">["kind"],
      node: ts.Node,
      ex: boolean,
    ) => symbols.push({ name, kind, exported: ex, line: line(node), endLine: endLine(node) });
    if (ts.isFunctionDeclaration(stmt))
      push(
        stmt.name?.text ?? (hasDefaultModifier(stmt) ? "default" : "<anonymous>"),
        "function",
        stmt,
        exported,
      );
    else if (ts.isClassDeclaration(stmt))
      push(stmt.name?.text ?? "default", "class", stmt, exported);
    else if (ts.isInterfaceDeclaration(stmt)) push(stmt.name.text, "interface", stmt, exported);
    else if (ts.isTypeAliasDeclaration(stmt)) push(stmt.name.text, "type", stmt, exported);
    else if (ts.isEnumDeclaration(stmt)) push(stmt.name.text, "enum", stmt, exported);
    else if (ts.isModuleDeclaration(stmt)) push(stmt.name.getText(sf), "namespace", stmt, exported);
    else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const init = d.initializer;
        const isFn =
          init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        push(d.name.text, isFn ? "function" : "variable", d, exported);
      }
    }
  };

  try {
    for (const stmt of sf.statements) {
      collectExports(stmt);
      topLevel(stmt);
    }
    visit(sf);
  } catch (e) {
    return {
      path,
      dependencies: deps,
      symbols: [],
      functions: [],
      dynamicUnresolved,
      parseError: `analysis error: ${(e as Error).message}`,
    };
  }
  for (const s of symbols) if (!s.exported && exportedNames.has(s.name)) s.exported = true;
  return {
    path,
    dependencies: deps,
    symbols,
    functions,
    dynamicUnresolved,
    parseError:
      syntaxErrors > 0
        ? `${syntaxErrors} syntax error(s); results for this file may be incomplete`
        : null,
  };
}

export const jsTsAnalyzer: AnalyzerPlugin = {
  id: "js-ts",
  version: "0.1.0",
  languages: ["javascript", "typescript"],
  supportLevel: 3,
  capabilities: ["imports", "exports", "symbols", "complexity", "resolution"],
  limitations: [
    "Dynamic imports and require calls with non-literal arguments are counted but not resolved.",
    "Imports are resolved with the TypeScript module resolver over the repository snapshot. Packages that exist only in node_modules (not analyzed) are reported as external.",
    "tsconfig extends targets outside the repository are ignored, so paths defined there are not applied.",
    "Framework conventions (for example file-system routing) are not modeled.",
    "Complexity counts decision points (if, loops, case, catch, ternary, logical and nullish operators) per function.",
  ],
  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult> {
    const resolver = new JsResolver(ctx.ws, ctx.allPaths);
    const files: FileAnalysis[] = [];
    let n = 0;
    for (const f of ctx.files) {
      if ((n++ & 63) === 0) throwIfAborted(ctx.signal);
      const text = ctx.ws.read(f.path);
      if (text === null) {
        files.push({
          path: f.path,
          dependencies: [],
          symbols: [],
          functions: [],
          dynamicUnresolved: 0,
          parseError: "file unreadable or over the per-file size budget",
        });
        continue;
      }
      files.push(analyzeJsTsFile(f.path, text, resolver));
    }
    const limitations = [...jsTsAnalyzer.limitations, ...[...resolver.configNotes].sort()];
    const dyn = files.reduce((s, x) => s + x.dynamicUnresolved, 0);
    if (dyn > 0)
      limitations.push(
        `${dyn} dynamic import or require call(s) with non-literal arguments were not resolved.`,
      );
    return { files, limitations };
  },
};
