# Phase 1: Engine and CLI

Status: **built and verified in the build environment, owner review and live verification open** (see section 5).
Estimated owner effort for the remaining checklist: 4 to 8 hours (apply, check, push, live verification, benchmarks).

## 1. Goal

A trustworthy analysis engine and CLI that produce JSON, Markdown and HTML reports for a local folder or a public GitHub repository, with measured accuracy on
hand-built fixtures, safe handling of untrusted input and honest coverage reporting.

## 2. What was delivered

| Backlog | Delivered | Where |
|---|---|---|
| P1-02 IR and schema | Types, JSON Schema, validator, invariants, published schema file, drift test | `packages/core/src/ir`, `packages/core/schema` |
| P1-03 Fixtures | 11 fixtures with hand-written ground truth | `fixtures/` |
| P1-04 Acquisition | Local walk, safe tar extractor, GitHub URL parser, archive download with redirect rules, budgets, hardened clone argument builder | `packages/core/src/acquire`, `pipeline/target.ts` |
| P1-05 Detection | Languages, file kinds, manifests, frameworks, entrypoints, license guess | `detect` |
| P1-06 JS/TS analyzer | Level 3 with TypeScript compiler API and workspace resolution | `analyzers/js-ts.ts` |
| P1-07 Graph | Edges, modules, Tarjan cycles, instability, levels, reachability | `graph` |
| P1-08 Metrics | LOC state machine, complexity, duplication | `metrics`, analyzers |
| P1-09 Rules | Rules language, YAML subset, 5 rule types, baseline, `diff` | `rules`, `report/diff.ts` |
| P1-10 Git history | Churn, hotspots, ownership, hardened Git, shallow handling | `git` |
| P1-11 Security | OSV, built-in secret patterns, Gitleaks adapter, workflow checks | `security` |
| P1-12 Practices | CI, tests, lint, docs, ADR detection | `practices` |
| P1-13 Scoring | Six dimensions, coverage, confidence, recommendations | `scoring`, `findings` |
| P1-14 Reports | JSON, Markdown, HTML (no scripts, CSP, escaped) | `report` |
| P1-15 CLI | analyze, report, diff, schema, exit codes, offline, baseline | `packages/cli` |
| P1-16 Python | Level 2 lexical analyzer (Level 3 is Later) | `analyzers/python.ts` |
| P1-17 Evaluation harness | Precision and recall over fixtures | `eval`, `docs/evaluation/results/phase-1.md` |
| P1-18 Benchmarks | Script and a labeled sandbox smoke run. **Official run is an owner task** | `scripts/benchmark.mjs` |
| P1-01 Gate spike | Comparison script. **Run on real repositories is an owner task** | `scripts/compare-edges.mjs` |

Extra: self-analysis in CI with this repository's rules (`repolens.rules.yaml`), PRD and use cases, reference docs, ADR 0015 and 0016, learning files.

## 3. Verification done in the build environment (facts)

- TypeScript 6.0.3 typechecks core and CLI with strict flags, `noUnusedLocals` and `noUncheckedIndexedAccess`.
- 165 tests pass on Node 22.22 (run through a small compatibility shim for the Vitest functions used, because Vitest could not be installed there).
- Fixture accuracy: precision and recall 1.0 in all five categories, all exact checks pass (`docs/evaluation/results/phase-1.md`).
- The tool analyzes this repository with its own rules: 0 violations. The generated reports validate against the schema.
- Sandbox smoke benchmark: see `docs/evaluation/results/sandbox-smoke.md`.

## 4. What was not verified (do not claim these until you do)

| Item | Why | How you verify |
|---|---|---|
| Real `pnpm install`, Biome lint and Vitest runs | No network in the build environment | `pnpm check` (section 5, step 3) |
| Live OSV lookups | No network | Analyze a repository with a lockfile without `--offline` |
| Gitleaks integration with the real binary | Binary not installed | Install Gitleaks, analyze a repo with a fake token |
| Real GitHub archive download | No network | `repolens analyze https://github.com/octocat/Hello-World` |
| `--with-history` clone | No network | Same with `--with-history` |
| Accuracy on real repositories and against Madge and dependency-cruiser | Needs real repositories | Gate P1-01 and P1-18 |
| Windows behavior | Linux only | Run `pnpm check` on Windows if that is your machine |

## 5. Owner checklist (exact steps)

### Step 1: Apply Phase 1 with the git flow
Follow `docs/workflow/git-flow-phase-1.md`. Short version, from your repo root with `main` clean:
```bash
git switch main && git pull
unzip repolens-phase1.zip -d ..            # creates ../repolens-phase1
node ../repolens-phase1/apply-phase-1.mjs  # creates branches, commits, merges them into phase/1-engine-cli
```

### Step 2: Install and check
```bash
pnpm install
pnpm format
pnpm check
```
`pnpm check` runs lint, build, typecheck and tests. If something fails, copy the first error and paste it into a new AI session with the "resume Phase 1" prompt below. Likely first-run issues: Biome version differences in `biome.json`,
a Vitest version difference, or a Windows path edge case.

### Step 3: Run the accuracy evaluation and self-analysis
```bash
pnpm --filter @repolens/core run eval
pnpm analyze:self          # writes ./repolens-report (ignored by git)
```
Open `repolens-report/report.html` in a browser and read it. Compare with `docs/learning/phase-1-engine-cli.md` section 3.

### Step 4: Push and open the pull request
```bash
git push -u origin phase/1-engine-cli
```
Open a PR into `main`. Wait for CI. Merge with **Rebase and merge** (or a merge commit) so the branch history is preserved. Squash would erase it. In Settings, General, Pull Requests, temporarily enable
"Allow rebase merging" if it is disabled, and keep squash for ordinary PRs later.

### Step 5: Live verification (record results in docs/evaluation/results)
1. GitHub download: `pnpm repolens analyze https://github.com/octocat/Hello-World -q --offline -o /tmp/hw`. Expected: a small report, status complete, Level 1 languages only.
2. OSV: pick any repository with a `package-lock.json`, run without `--offline`. Expected: `security.dependencies.assessed: true`.
3. Gitleaks: install it, run `repolens analyze` on a throwaway folder containing a fake token. Expected: `secrets` shows tool `gitleaks` assessed.
4. Gate P1-01: follow `docs/evaluation/results/p1-01-spike.md` on 3 public repositories.
5. Benchmark P1-18: follow `docs/evaluation/results/benchmarks.md` for 5 repositories.

### Step 6: Update the records
Update `docs/PROJECT_STATE.md`, mark P1 items in `docs/roadmap/backlog.md`, update ADR 0004 validation, `docs/registers/decision-register.md`. Read `docs/learning/phase-1-engine-cli.md` and answer its question bank aloud.

## 6. Exit criteria status

| Criterion | Status |
|---|---|
| `repolens analyze <path or github-url>` produces JSON, Markdown, HTML | Done for paths (tested). GitHub URL path implemented, live check pending (step 5.1) |
| Report validates against the published JSON Schema | Done (every report in tests and CI) |
| Every finding has id, severity, confidence, evidence, location, remediation, limitations | Done (schema enforced) |
| Unsupported languages get honest partial reports | Done (fixture `unsupported-only`) |
| Missing data is "not assessed", never zero | Done (tests) |
| Fixture accuracy recorded | Done (`phase-1.md`) |
| Benchmarks on 5 public repositories | **Open (owner)**, smoke run recorded |
| Exit codes work in CI | Done (CLI tests, self-analysis step) |
| Offline mode | Done (OSV "not assessed (offline)") |
| Safe extraction tests | Done (`tar.test.ts`) |
| `pnpm check` green in CI, core coverage at least 80 percent | **Open**: CI green is pending your first run. Coverage is not measured yet (add `vitest --coverage` in Phase 3) |
| ADRs and PROJECT_STATE updated | Done in this delivery, owner review pending |

Phase 1 is complete when every row is Done and the owner confirms.

## 7. Prompt: resume Phase 1 in a new chat

```text
Project: RepoLens. I am the sole developer. Read CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-1-engine-cli.md,
docs/learning/phase-1-engine-cli.md, docs/roadmap/backlog.md and the decision register.
We are finishing Phase 1 (Engine and CLI). The code is built and was verified without network access. I am now on the owner checklist
in section 5. Help me with the step I am on (I will paste command output or errors). Fix problems with small, tested changes,
keep docs/PROJECT_STATE.md and docs/learning/phase-1-engine-cli.md accurate, and do not claim anything that was not run.
```

## 8. Next step after Phase 1

Phase 1.5 (insight upgrade) comes before Phase 2. Follow `docs/phases/phase-1-5-insight-upgrade.md`. The Phase 2 prompt is `docs/prompts/phase-2-prompt.md`.
