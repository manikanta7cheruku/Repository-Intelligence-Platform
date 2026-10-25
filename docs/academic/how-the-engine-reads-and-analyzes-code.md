# How RepoLens reads files and code, and how it analyzes them

Academic explanation of the engine, from "a folder or GitHub URL" to "a scored report". Every statement refers to code in `packages/core/src`.
Nothing here describes machine learning: the engine is deterministic static analysis plus transparent formulas.

## 1. The big picture

```
target (folder or GitHub URL)
  -> acquire        read files safely into a bounded Workspace (acquire/)
  -> classify       language, kind (source, test, generated, vendored, binary), line counts (pipeline/files.ts, detect/)
  -> analyze        parse each source file, extract imports, symbols, functions (analyzers/)
  -> graph          build the file and module dependency graph, find cycles (graph/)
  -> metrics        size, complexity, duplication, coverage (metrics/)
  -> rules          user architecture rules and baseline (rules/)
  -> history        Git commits, churn, contributors, commit quality (git/)
  -> security       OSV advisories, secrets, workflow risks (security/)
  -> practices      README, license, CI, tests present? (practices/)
  -> risk, impact   cross-signal risk index and blast radius (risk/, graph/impact.ts)
  -> findings       evidence-backed issues (findings/)
  -> scores         explainable scores with inputs and points to gain (scoring/)
  -> report         JSON (source of truth), Markdown, HTML (report/)
```

The orchestrator is `analyze()` in `pipeline/analyze.ts`. Each stage reports its own failure; one failing stage never silently becomes a zero.

## 2. Step 1: reading files safely (acquire)

- **Local folders** (`acquire/local.ts`): a deterministic, sorted directory walk. It never follows symbolic links, skips `.git`, `node_modules`, virtual environments and build caches
  (the reason for every exclusion is counted and reported), and stops at configured budgets (maximum files, bytes per file, total bytes).
- **GitHub URLs** (`acquire/github.ts`, `acquire/tar.ts`): only `github.com` is accepted. The repository is downloaded as an archive and extracted by a hand-written, defensive tar reader
  that rejects path traversal (`..`), absolute paths, links and oversized entries. A host such as `github.com.evil.com` is refused.
- **Security rule: no code from the analyzed repository is ever executed.** Files are only read as text. Git commands run with hostile-configuration hardening (for example, a configured `fsmonitor` program is not run; a test proves it).

Result: a `Workspace` with a sorted file list and a `read(path)` function. Everything after this stage sees only this bounded view.

## 3. Step 2: classifying files

`pipeline/files.ts` and `detect/classify.ts` decide for every file:

1. **Language** from the extension (`detect/languages.ts`).
2. **Kind**: source, test (by path patterns such as `*.test.ts`, `tests/`), generated (marker such as "auto-generated" in the header), vendored, binary (NUL bytes in the first 8000 characters), or other.
3. **Line counts**: total, code, comment, blank (`metrics/loc.ts`, a small lexer per language family).

Files over the size budget or unreadable get a `notAnalyzedReason`. This is why the report can say "182 files in total, 92 code files, 91 analyzed" instead of one confusing ratio.
`detect/manifests.ts` also reads `package.json`, `pyproject.toml`, lockfiles and workflows to detect frameworks, entrypoints and package directories.

## 4. Step 3: understanding the code (language analyzers)

An analyzer is a plugin with a **support level** that is shown honestly in every report.

| Language | Technique | Level | What it extracts |
|---|---|---|---|
| TypeScript, JavaScript | The real **TypeScript compiler API** builds an abstract syntax tree (AST) per file (`analyzers/js-ts.ts`) | 3 | imports, exports, symbols, functions, complexity |
| Python | Text scanning after comments and strings are blanked out (`analyzers/python.ts`, `stripPython`), not a full parser | 2 | imports (absolute, relative, `from x import y`), functions, simple complexity |
| Other languages | Detection and line counts only | 1 | size only, reported as such |

How imports become edges:

- Each import specifier (`./util/hash`, `react`, `os`, `..models`) is **resolved**. For JS/TS the TypeScript module resolver runs over an in-memory copy of the repository (`JsResolver`), so `tsconfig` paths, `index` files and workspace packages work without touching disk.
  Python imports are resolved against package directories.
- Result per import: internal file, third-party package, built-in (standard library), or unresolved (with a reason). Unresolved imports are listed, never dropped.

How complexity is measured: **cyclomatic complexity** (`cyclomaticComplexity` in `analyzers/js-ts.ts`) starts at 1 for a function and adds 1 for every decision point (`if`, loops, `case`, `catch`, `&&`, `||`, `??`, ternary).
Higher means more paths to test. Thresholds (moderate, high, very high) are configurable conventions, not laws.

Each analyzer runs isolated in a try/catch: if one crashes, its languages fall back to level 1, the report is marked `partial`, and the reason is shown.

## 5. Step 4: the dependency graph

`graph/build.ts` turns resolved dependencies into a graph:

- **Nodes**: production source files (tests are excluded from architecture). **Edges**: "file A imports file B", flagged runtime or type-only.
- **Modules**: files are grouped by directory (or package) so architecture can be read at a higher level, with edges aggregated between modules.
- **Cycles**: `graph/scc.ts` implements **Tarjan's strongly connected components algorithm** (iterative, so deep graphs cannot overflow the stack). A component with more than one node is a circular dependency.
- **Levels and reachability**: modules are layered by dependency depth, and entrypoints are used to compute which files are reachable.
- **Blast radius** (`graph/impact.ts`): a reverse index ("who imports me") and a breadth-first walk give direct dependents, all dependents, longest chain, affected modules and entrypoints.
  Limit: only static imports are followed. Dynamic `import()` with computed strings and framework magic are not.

## 6. Step 5: rules, history, security, practices

- **Architecture rules** (`rules/`): a YAML file defines layers by glob and rules such as `allowOnly`, `forbid cycles`, `forbid external`, and `limit` (for example, files up to 700 code lines). The engine evaluates edges against layers and reports violations with file and line.
  A **baseline** lets a team accept existing violations and fail only on new ones.
- **History** (`git/`): `git log` is read with a restricted, hardened command. From it: commits, contributors, **hotspots** (files changed often and complex), ownership, commit message quality (Conventional Commit share, subject length, vague messages). For remote repositories the GitHub API gives a sample of the latest 300 commits, merged pull requests and releases.
- **Security** (`security/`): dependency packages are extracted from lockfiles and queried against the **OSV** vulnerability database (online only); a built-in secret scanner and optional Gitleaks look for credentials (the secret value is never written to the report); workflow checks flag unpinned third-party actions and risky expressions.
  Advisories in development-only tools count 40 percent, because they do not ship to users.
- **Practices** (`practices/`): is there a README with install and usage sections, a license, CI, tests, a contributing guide, a security policy.

## 7. Step 6: findings and scores

- A **finding** is one issue with an id, severity, confidence, evidence (metric values and file references), location, remediation and limitations (`findings/generate.ts`). No evidence, no finding.
- **Scores** (`scoring/score.ts`) are weighted sums of named inputs. Every score lists its inputs, the share of inputs actually available ("Inputs used"), and "points to gain" per input. If inputs are missing the score is **not assessed** with a reason: **missing data is never shown as zero**.
  Confidence is capped by language support level, for example a Python plus TypeScript repository cannot have high architecture confidence.
- **Recommendations** (`scoring/recommend.ts`) are rules over findings: group by package, pick the nearest fixed version from OSV, derive effort from the version jump (patch low, minor medium, major high).
- **Risk index** (`risk/risk.ts`): weighted mean of percentiles: complexity 0.30, number of dependents 0.25, change frequency 0.25, lack of test linkage or coverage 0.20 (at least two factors needed). It ranks files by cost of change. It does not predict bugs, and its weights are provisional until calibration in Phase 3.

## 8. Step 7: reports and determinism

The JSON report (schema 0.2.0, validated on every run by `ir/schema.ts`) is the single source of truth; Markdown and HTML are renderers of it. The HTML report is self-contained: no scripts, strict Content-Security-Policy (`default-src 'none'`), all text escaped.
Output is deterministic: sorted traversal, ids from content hashes, `stableStringify`, and a test that reorders files and asserts an identical content hash.

## 9. Extra commands built on the same model

| Command | Idea |
|---|---|
| `repolens pr --base main` | Analyze the base ref in a temporary Git worktree and the head, diff the two reports, apply thresholds to give regressed, improved or unchanged |
| `repolens trend --points 6` | Analyze evenly spaced commits in worktrees (structure only, offline) and report growth and drift |
| `repolens impact report.json file` | Blast radius from a saved report |
| `repolens graph report.json -f svg` | Mermaid, DOT or SVG export of the module graph |
| `repolens glossary` | Five answers per term used in the report |

## 10. How is accuracy checked?

`eval/` contains 12 small fixture repositories with hand-written ground truth (expected edges, cycles, violations, blast radius). A regression gate test (`eval/accuracy.test.ts`) requires accuracy 1.0 on them. Fixtures written by the author can share the author's blind spots, so real-repository benchmarks are recorded separately in `docs/evaluation/results`.

## 11. Honest limits

Static analysis only; no runtime behavior. Python is level 2 (text-based). Blast radius ignores dynamic links. Risk weights and PR thresholds are provisional. Remote history is a sample. A clean report does not prove a repository is secure or well designed.
