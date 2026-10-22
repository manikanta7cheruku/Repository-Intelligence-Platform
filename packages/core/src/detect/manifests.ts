import type { DetectionSummary } from "../ir/types.js";
import type { Workspace } from "../acquire/types.js";
import { basename, dirname } from "../util/paths.js";

const LOCKFILES: Record<string, string> = {
  "package-lock.json": "npm",
  "npm-shrinkwrap.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "bun.lockb": "bun",
  "bun.lock": "bun",
  "poetry.lock": "poetry",
  "Pipfile.lock": "pipenv",
  "uv.lock": "uv",
  "Cargo.lock": "cargo",
  "go.sum": "go modules",
  "Gemfile.lock": "bundler",
  "composer.lock": "composer",
};
const MANIFESTS: Record<string, string> = {
  "package.json": "npm",
  "pyproject.toml": "python packaging",
  "requirements.txt": "pip",
  "Pipfile": "pipenv",
  "setup.py": "setuptools",
  "go.mod": "go modules",
  "Cargo.toml": "cargo",
  "pom.xml": "maven",
  "build.gradle": "gradle",
  "build.gradle.kts": "gradle",
  Gemfile: "bundler",
  "composer.json": "composer",
};
const BUILD_TOOLS: Record<string, string> = {
  Makefile: "make", "vite.config.ts": "vite", "vite.config.js": "vite", "webpack.config.js": "webpack",
  "rollup.config.js": "rollup", "turbo.json": "turborepo", "nx.json": "nx", Dockerfile: "docker",
  "tsconfig.json": "tsc", "next.config.js": "next", "next.config.mjs": "next", "next.config.ts": "next",
};
const JS_FRAMEWORKS: Record<string, string> = {
  next: "Next.js", react: "React", vue: "Vue", svelte: "Svelte", "@angular/core": "Angular", express: "Express",
  fastify: "Fastify", "@nestjs/core": "NestJS", koa: "Koa", nuxt: "Nuxt", astro: "Astro", electron: "Electron",
  vitest: "Vitest", jest: "Jest", mocha: "Mocha", "@playwright/test": "Playwright", cypress: "Cypress",
};
const PY_FRAMEWORKS: Record<string, string> = {
  django: "Django", flask: "Flask", fastapi: "FastAPI", pytest: "pytest", numpy: "NumPy", pandas: "pandas",
  torch: "PyTorch", tensorflow: "TensorFlow", sqlalchemy: "SQLAlchemy", celery: "Celery",
};

export interface PackageJson {
  name?: string;
  main?: string;
  module?: string;
  types?: string;
  bin?: string | Record<string, string>;
  exports?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

export function parseJsonSafe<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    return JSON.parse(text.replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

export function readPackageJson(ws: Workspace, path: string): PackageJson | null {
  const parsed = parseJsonSafe<PackageJson>(ws.read(path));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
}

const SPDX_HINTS: [RegExp, string][] = [
  [/Apache License[\s\S]{0,80}Version 2\.0/i, "Apache-2.0"],
  [/MIT License|Permission is hereby granted, free of charge/i, "MIT"],
  [/GNU AFFERO GENERAL PUBLIC LICENSE/i, "AGPL-3.0"],
  [/GNU LESSER GENERAL PUBLIC LICENSE/i, "LGPL"],
  [/GNU GENERAL PUBLIC LICENSE[\s\S]{0,80}Version 3/i, "GPL-3.0"],
  [/GNU GENERAL PUBLIC LICENSE[\s\S]{0,80}Version 2/i, "GPL-2.0"],
  [/Mozilla Public License[\s\S]{0,40}2\.0/i, "MPL-2.0"],
  [/BSD 3-Clause|Redistribution and use in source and binary forms/i, "BSD (verify variant)"],
  [/ISC License/i, "ISC"],
  [/The Unlicense|unencumbered software/i, "Unlicense"],
];

export function detectProject(ws: Workspace): DetectionSummary {
  const managers = new Set<string>();
  const manifests: string[] = [];
  const lockfiles: string[] = [];
  const buildTools = new Set<string>();
  const runtimes = new Set<string>();
  const frameworks = new Map<string, string>();
  const entrypoints = new Map<string, string>();
  let licenseFile: string | null = null;

  for (const f of ws.files) {
    const name = basename(f.path);
    if (MANIFESTS[name]) {
      manifests.push(f.path);
      managers.add(MANIFESTS[name] as string);
    }
    if (LOCKFILES[name]) {
      lockfiles.push(f.path);
      managers.add(LOCKFILES[name] as string);
    }
    if (BUILD_TOOLS[name]) buildTools.add(BUILD_TOOLS[name] as string);
    if (dirname(f.path) === "" && /^(licen[sc]e|copying)(\.[a-z]+)?$/i.test(name)) licenseFile = f.path;
  }

  for (const path of manifests.filter((m) => basename(m) === "package.json")) {
    runtimes.add("node");
    const pkg = readPackageJson(ws, path);
    if (!pkg) continue;
    const dir = dirname(path);
    const at = (p: string) => (dir ? `${dir}/${p}` : p).replace(/^\.\//, "");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const [dep, label] of Object.entries(JS_FRAMEWORKS)) {
      if (dep in deps && !frameworks.has(label)) frameworks.set(label, `${dep} in ${path}`);
    }
    const addEntry = (p: string | undefined, reason: string) => {
      if (typeof p !== "string") return;
      const clean = at(p.replace(/^\.\//, ""));
      entrypoints.set(clean, reason);
    };
    addEntry(pkg.main, `main field of ${path}`);
    addEntry(pkg.module, `module field of ${path}`);
    if (typeof pkg.bin === "string") addEntry(pkg.bin, `bin field of ${path}`);
    else if (pkg.bin && typeof pkg.bin === "object") for (const v of Object.values(pkg.bin)) addEntry(v, `bin field of ${path}`);
    if (pkg.scripts) {
      const start = pkg.scripts.start ?? pkg.scripts.dev;
      const m = start ? /\b(?:node|tsx|ts-node)\s+([\w./-]+\.(?:[cm]?[jt]s))/.exec(start) : null;
      if (m) addEntry(m[1], `start script of ${path}`);
    }
  }
  for (const f of ws.files) {
    const name = basename(f.path);
    if (/^(requirements.*\.txt)$/.test(name) || name === "pyproject.toml" || name === "Pipfile") {
      runtimes.add("python");
      const text = ws.read(f.path) ?? "";
      for (const [dep, label] of Object.entries(PY_FRAMEWORKS)) {
        if (new RegExp(`(^|[\\s"'\\[,])${dep}([\\s=<>~!\\[;"',]|$)`, "im").test(text) && !frameworks.has(label)) {
          frameworks.set(label, `${dep} in ${f.path}`);
        }
      }
    }
    if (name === "__main__.py") entrypoints.set(f.path, "python package entry (__main__.py)");
    if (name === "manage.py") entrypoints.set(f.path, "Django management script");
    if (/^(main|app|cli)\.py$/.test(name) && dirname(f.path).split("/").length <= 2) entrypoints.set(f.path, "conventional python entry file");
    if (name === "go.mod") runtimes.add("go");
    if (name === "Cargo.toml") runtimes.add("rust");
    if (name === "pom.xml" || name.startsWith("build.gradle")) runtimes.add("jvm");
    if (name === "main.go") entrypoints.set(f.path, "go main file");
  }
  for (const idx of ["src/index.ts", "src/index.js", "src/main.ts", "src/main.js", "index.js", "index.ts"]) {
    if (ws.has(idx) && !entrypoints.has(idx)) entrypoints.set(idx, "conventional entry file name");
  }

  let spdx: string | null = null;
  if (licenseFile) {
    const text = ws.read(licenseFile) ?? "";
    spdx = SPDX_HINTS.find(([re]) => re.test(text))?.[1] ?? null;
  }

  return {
    packageManagers: [...managers].sort(),
    manifests: manifests.sort(),
    lockfiles: lockfiles.sort(),
    frameworks: [...frameworks.entries()].map(([name, evidence]) => ({ name, evidence })).sort((a, b) => a.name.localeCompare(b.name)),
    entrypoints: [...entrypoints.entries()].filter(([p]) => ws.has(p)).map(([path, reason]) => ({ path, reason })).sort((a, b) => a.path.localeCompare(b.path)),
    buildTools: [...buildTools].sort(),
    runtimes: [...runtimes].sort(),
    license: { file: licenseFile, spdxGuess: spdx },
  };
}
