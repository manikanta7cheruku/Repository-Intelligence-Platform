import ts from "typescript";
import type { Workspace } from "../acquire/types.js";
import type { DetectionSummary, FileRecord, PracticesSummary } from "../ir/types.js";
import { parseJsonSafe, readPackageJson } from "../detect/manifests.js";
import { basename, dirname } from "../util/paths.js";

const hasPath = (ws: Workspace, re: RegExp): boolean => ws.files.some((f) => re.test(f.path));

export function detectPractices(
  ws: Workspace,
  files: FileRecord[],
  detection: DetectionSummary,
): PracticesSummary {
  const paths = ws.files.map((f) => f.path);
  const providers = new Set<string>();
  const workflowFiles = paths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).sort();
  if (workflowFiles.length > 0) providers.add("GitHub Actions");
  if (paths.includes(".gitlab-ci.yml")) providers.add("GitLab CI");
  if (paths.some((p) => p.startsWith(".circleci/"))) providers.add("CircleCI");
  if (paths.includes("Jenkinsfile")) providers.add("Jenkins");
  if (paths.includes("azure-pipelines.yml")) providers.add("Azure Pipelines");
  if (paths.includes(".travis.yml")) providers.add("Travis CI");
  if (paths.includes("bitbucket-pipelines.yml")) providers.add("Bitbucket Pipelines");

  const depNames = new Set<string>();
  let hasTestScript = false;
  for (const m of detection.manifests.filter((x) => basename(x) === "package.json")) {
    const pkg = readPackageJson(ws, m);
    if (!pkg) continue;
    for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) depNames.add(d);
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) hasTestScript = true;
  }
  const pyText = ws.files
    .filter((f) =>
      /(requirements.*\.txt|pyproject\.toml|setup\.cfg|tox\.ini|Pipfile)$/.test(f.path),
    )
    .map((f) => ws.read(f.path) ?? "")
    .join("\n");
  const py = (name: string) =>
    new RegExp(`(^|[\\s"'\\[,])${name}([\\s=<>~!\\[;"',]|$)`, "im").test(pyText);

  const testFrameworks = new Set<string>();
  for (const [dep, label] of Object.entries({
    vitest: "Vitest",
    jest: "Jest",
    mocha: "Mocha",
    ava: "AVA",
    "@playwright/test": "Playwright",
    cypress: "Cypress",
  }))
    if (depNames.has(dep)) testFrameworks.add(label);
  if (py("pytest")) testFrameworks.add("pytest");
  if (
    files.some(
      (f) => f.language === "python" && f.kind === "test" && /unittest/.test(ws.read(f.path) ?? ""),
    )
  )
    testFrameworks.add("unittest");
  if (hasTestScript && testFrameworks.size === 0)
    testFrameworks.add("npm test script (framework not identified)");

  const linters = new Set<string>();
  if (
    depNames.has("eslint") ||
    hasPath(ws, /(^|\/)(\.eslintrc(\.[a-z]+)?|eslint\.config\.[cm]?[jt]s)$/)
  )
    linters.add("ESLint");
  if (hasPath(ws, /(^|\/)biome\.jsonc?$/) || depNames.has("@biomejs/biome")) linters.add("Biome");
  if (hasPath(ws, /(^|\/)ruff\.toml$/) || /\[tool\.ruff/.test(pyText) || py("ruff"))
    linters.add("Ruff");
  if (hasPath(ws, /(^|\/)\.flake8$/) || py("flake8")) linters.add("Flake8");
  if (hasPath(ws, /(^|\/)\.pylintrc$/) || py("pylint")) linters.add("Pylint");
  const formatters = new Set<string>();
  if (depNames.has("prettier") || hasPath(ws, /(^|\/)\.prettierrc(\.[a-z]+)?$/))
    formatters.add("Prettier");
  if (linters.has("Biome")) formatters.add("Biome");
  if (/\[tool\.black/.test(pyText) || py("black")) formatters.add("Black");
  if (/\[tool\.ruff\.format/.test(pyText)) formatters.add("Ruff format");
  const typeCheckers = new Set<string>();
  let strict: boolean | null = null;
  const tsconfig =
    paths.find((p) => basename(p) === "tsconfig.json" && dirname(p) === "") ??
    paths.find((p) => basename(p) === "tsconfig.json");
  if (tsconfig) {
    typeCheckers.add("TypeScript");
    const text = ws.read(tsconfig);
    if (text !== null) {
      const parsed = ts.parseConfigFileTextToJson(tsconfig, text).config as
        | { compilerOptions?: { strict?: boolean } }
        | undefined;
      strict = parsed?.compilerOptions?.strict === true;
    }
  }
  if (hasPath(ws, /(^|\/)mypy\.ini$/) || /\[tool\.mypy/.test(pyText) || py("mypy"))
    typeCheckers.add("mypy");
  if (hasPath(ws, /(^|\/)pyrightconfig\.json$/) || py("pyright")) typeCheckers.add("Pyright");

  const testFiles = files.filter((f) => f.kind === "test").length;
  const sourceFiles = files.filter((f) => f.kind === "source").length;

  const readmePath = paths.find((p) => /^readme(\.[a-z]+)?$/i.test(p)) ?? null;
  let readme: PracticesSummary["documentation"]["readme"] = {
    path: null,
    words: null,
    headings: [],
    hasInstall: null,
    hasUsage: null,
  };
  if (readmePath) {
    const text = ws.read(readmePath) ?? "";
    const headings = text
      .split(/\r?\n/)
      .filter((l) => /^#{1,6}\s+\S/.test(l))
      .map((l) => l.replace(/^#+\s+/, "").trim())
      .slice(0, 40);
    readme = {
      path: readmePath,
      words: text.split(/\s+/).filter(Boolean).length,
      headings,
      hasInstall:
        headings.some((h) => /install|setup|getting started|build/i.test(h)) ||
        /```[\s\S]*(npm|pnpm|yarn|pip|cargo|go) (install|i|add|build)/i.test(text),
      hasUsage: headings.some((h) => /usage|quick ?start|example|how to/i.test(h)),
    };
  }
  const adrFiles = paths.filter(
    (p) =>
      /(^|\/)(adrs?|decisions)\/[^/]+\.md$/i.test(p) &&
      !/(^|\/)readme\.md$/i.test(p) &&
      !/template/i.test(p),
  );
  const adrDirs = [
    ...new Set(paths.filter((p) => /(^|\/)(adrs?|decisions)\/[^/]+\.md$/i.test(p)).map(dirname)),
  ].sort();
  const root = (re: RegExp) => paths.some((p) => !p.includes("/") && re.test(p));

  return {
    ci: { providers: [...providers].sort(), workflowFiles },
    tests: {
      frameworks: [...testFrameworks].sort(),
      testFiles,
      sourceFiles,
      testToSourceFileRatio:
        sourceFiles === 0 ? null : Math.round((testFiles / sourceFiles) * 1000) / 1000,
      coverageReport: "not-ingested",
    },
    quality: {
      linters: [...linters].sort(),
      formatters: [...formatters].sort(),
      typeCheckers: [...typeCheckers].sort(),
      strictTypeScript: strict,
    },
    documentation: {
      readme,
      files: {
        contributing:
          root(/^contributing(\.[a-z]+)?$/i) || paths.includes(".github/CONTRIBUTING.md"),
        codeOfConduct:
          root(/^code_of_conduct(\.[a-z]+)?$/i) || paths.includes(".github/CODE_OF_CONDUCT.md"),
        security: root(/^security(\.[a-z]+)?$/i) || paths.includes(".github/SECURITY.md"),
        changelog: root(/^(changelog|history|releases)(\.[a-z]+)?$/i),
        license: detection.license.file !== null,
      },
      docsDirectory: paths.some((p) => /^(docs?|documentation)\//i.test(p)),
      adrDirectories: adrDirs,
      adrCount: adrFiles.length,
    },
    setup: {
      dockerfile: paths.some((p) => basename(p) === "Dockerfile"),
      envExample: paths.some((p) => /^\.env\.(example|sample|template)$/.test(basename(p))),
      makefile: paths.some((p) => basename(p) === "Makefile"),
      devcontainer: paths.some((p) => p.startsWith(".devcontainer/")),
    },
  };
}

/** Reads a JSON file with comments allowed. Exposed for tests. */
export function readJsonc<T>(text: string): T | null {
  return (
    parseJsonSafe<T>(text) ??
    (ts.parseConfigFileTextToJson("x.json", text).config as T | undefined) ??
    null
  );
}
