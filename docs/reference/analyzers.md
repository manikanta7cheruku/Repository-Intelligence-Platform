# Analyzer reference

Each language analyzer is a plugin (`AnalyzerPlugin`) that declares its support level, capabilities and
limitations. The report lists them per language in the coverage section, so users see what each conclusion is
based on. Adding a language means adding a plugin to the registry. The pipeline does not change.

## Support levels

| Level | Meaning | Languages today |
|---|---|---|
| 1 | Detection, file classification, line counts | Every recognized language without an analyzer (Go, Rust, Java, C and others) |
| 2 | Syntax level imports and top-level symbols | Python |
| 3 | Resolved dependency graph and symbols | JavaScript, TypeScript |
| 4 | Semantic analysis, call graphs | none |
| 5 | Framework specific architecture | none |

## js-ts (Level 3)

Capabilities: imports, exports, symbols, complexity, resolution. Parser: TypeScript compiler API (`createSourceFile`, `resolveModuleName`) over an in-memory view of the repository, with no node_modules and no code execution.

Import forms: `import`, `import type` (type-only), `export ... from` (re-export), `import x = require()`, `require("x")`, `import("x")` with a literal, `import("x").T` types. Non-literal dynamic imports are counted, not guessed.

Resolution: nearest `tsconfig.json` or `jsconfig.json` (paths, baseUrl, extends inside the repository), `.js` specifiers mapped to `.ts`, directory index files, `package.json` imports, workspace packages by name and subpath (maps `dist` entries back to `src`), JSON imports. Results are `resolved`, `external` (package name or built-in), `unresolved` (with reason) or `ignored` (URLs).

Known limitations: tsconfig `extends` to packages outside the repository, framework conventions (file system routing), generated files that are not in the repository, `exports` conditions beyond the first matching string.

Complexity: 1 plus decision points per function (`if`, loops, `case`, `catch`, ternary, `&&`, `||`, `??` and assignment forms). Nested functions are measured separately.

## python (Level 2)

Capabilities: imports, symbols, resolution, complexity (approximate). Parser: lexical. Strings and comments are blanked first, then `import` and `from ... import` statements are parsed, including multiline parentheses, backslash continuations, aliases and `TYPE_CHECKING` blocks.

Resolution: source roots are inferred from `__init__.py` package layout and `src` or `lib` directories. Relative imports resolve by dots. `from pkg import name` links to the submodule file when it exists. Standard library names are external built-ins unless a repository module shadows them. Unknown top-level names are assumed third-party.

Known limitations: dynamic imports (`importlib`, `__import__`), namespace packages without `__init__.py`, conditional `sys.path` changes, only top-level `def` and `class` as symbols, complexity from keywords.

## generic (Level 1)

Records language, file kind, bytes, lines and code lines. No dependency, symbol or complexity analysis. Architecture scores that need a graph are "not assessed" when no analyzed source exists.

## Other detectors

| Area | Method |
|---|---|
| Frameworks | Dependencies in package.json, requirements and pyproject |
| Entrypoints | `main`, `module`, `bin`, start script, `__main__.py`, `manage.py`, `main.go`, conventional `src/index.*` and `src/main.*` names, only when the file exists |
| File kinds | Path rules first, then content markers such as `@generated`, NUL bytes for binaries |
| Practices | File and configuration inspection, no execution |
| Workflows | Line based checks of `.github/workflows` |
