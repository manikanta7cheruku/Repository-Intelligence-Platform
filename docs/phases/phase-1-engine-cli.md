# Phase 1: Engine and CLI

Estimated owner effort: 120 to 160 hours. Backlog items: P1-01 to P1-18 in `docs/roadmap/backlog.md`.

## Goal

A trustworthy analysis engine and a CLI that produce complete JSON, Markdown, and HTML reports for a
local or public GitHub repository, with measured accuracy on hand-built fixtures.

## Scope

In: JS/TS at support Level 3, Python at Level 2 (stretch to 3), all other languages Level 1.
Repository acquisition, dependency graph and cycles, coupling metrics, complexity and duplication,
architecture rules and baselines, Git hotspots, OSV and Gitleaks integration, workflow checks,
practices detection, scoring with coverage and confidence, reports, CLI.

Out: web app, database, accounts, hosted jobs, call graphs, ML, dynamic analysis.

## Order of work

1. Gate: P1-01 spike. Measure TypeScript module resolution accuracy on 3 real repositories. Decide per ADR 0004 whether to keep the TypeScript compiler API.
2. Contracts: P1-02 IR and report schema v0 (frozen at the end of week 1 of the phase). Everything else depends on it.
3. Ground truth: P1-03 fixtures before analyzers, so every analyzer is built test-first.
4. Acquisition and detection: P1-04, P1-05.
5. Analysis: P1-06 to P1-10.
6. Security and practices: P1-11, P1-12.
7. Scoring and reports: P1-13, P1-14.
8. CLI: P1-15.
9. Stretch: P1-16 Python.
10. Evaluation: P1-17, P1-18.

## Exit criteria

- [ ] `repolens analyze <path|github-url>` produces JSON, Markdown, and HTML reports
- [ ] Report validates against the published JSON Schema (versioned)
- [ ] Every finding has id, severity, confidence, evidence, location, remediation, limitations
- [ ] Unsupported languages produce an honest partial report, never fabricated architecture
- [ ] Missing data is "not assessed" with a reason everywhere, never zero
- [ ] Fixture accuracy results recorded in `docs/evaluation/results/phase-1.md` (precision and recall for dependency edges, cycles, rule violations)
- [ ] Benchmarks on at least 5 public repositories recorded (time, peak memory, coverage)
- [ ] CLI exit codes work in CI (0 pass, 1 policy failure, 2 usage error, 3 analysis error, 4 partial result when `--fail-on-partial`)
- [ ] Offline mode works for everything except OSV lookups, which report "not assessed (offline)"
- [ ] Safe extraction tests pass (traversal, symlink, bomb, size caps)
- [ ] `pnpm check` green in CI, core coverage at least 80 percent on engine logic
- [ ] ADR statuses updated, `PROJECT_STATE.md` updated

## Prompt: resume Phase 1 in a new chat

```text
Project: RepoLens. I am the sole developer. Read CLAUDE.md, docs/PROJECT_STATE.md,
docs/phases/phase-1-engine-cli.md, docs/roadmap/backlog.md, and the decision register.
We are in Phase 1 (Engine and CLI). PROJECT_STATE lists which backlog items are done.
Continue with the next unfinished item. Plan briefly, implement with tests against the fixtures,
run pnpm check, update PROJECT_STATE, and tell me exactly what to verify manually.
```

## Prompt: start Phase 2 (paste when Phase 1 exit criteria are met)

```text
Project: RepoLens, open-source repository intelligence platform. I am the sole developer.
Read first: CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-2-web-platform.md, docs/ux/*,
docs/architecture/*, docs/security/threat-model.md, docs/registers/decision-register.md, all ADRs,
and the Phase 1 results in docs/evaluation/results/phase-1.md.

What we did before (Phase 0 and 1): Phase 0 produced the repo, CI, documentation, ADRs, threat model,
UX direction and tokens. Phase 1 delivered packages/core and packages/cli: acquisition, JS/TS (and
Python if completed) analyzers, dependency graph and cycles, metrics, architecture rules, Git
hotspots, OSV and Gitleaks integration, scoring with coverage and confidence, JSON/Markdown/HTML
reports, and fixture-based accuracy results. The report schema is versioned and frozen at its
current version.

What we do now (Phase 2, Web platform): build apps/web, the API, the worker, and the database to the
Phase 2 exit criteria. Start with gate P2-01 (graph rendering benchmark with a 1,000 node and a 5,000
node fixture) and stop to show me the numbers before choosing the graph library (ADR 0012). Then
build the design system from docs/ux/design-tokens.md before any page. The frontend consumes the
report schema only, never engine internals. The UI must follow docs/ux with no generic AI SaaS
look: dense, calm, evidence first, accessible, no fake metrics, no em dashes.

Work item by item through P2-02 onward. Plan briefly, implement, test, run pnpm check, update
PROJECT_STATE, and tell me exactly what to run and verify. Ask at most one question at a time with a
proposed default.
```
