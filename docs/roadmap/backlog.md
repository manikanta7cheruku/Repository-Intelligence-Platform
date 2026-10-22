# Backlog

Status legend for Phase 0 and 1: Done, Built (code complete, owner verification open), Open.

Estimates are hours. Create GitHub issues for the current phase only. IDs are stable.
Each item is done only when its acceptance criteria are met and `pnpm check` passes.

## Phase 0

| ID | Item | Est | Acceptance |
|---|---|---|---|
| P0-01 | Create GitHub repo and push scaffold **[Done]** | 1 | Repo public, first commit pushed |
| P0-02 | Repository settings and protections **[Done]** | 1 | Checklist step 5 complete |
| P0-03 | First green CI **[Done]** | 1 | CI green on main |
| P0-04 | Research session: competitor matrix and licenses **[Open]** | 4 | Matrix rows sourced or marked Unverified |
| P0-05 | Verification checklist C-01 to C-20 **[Open]** | 4 | Each item resolved or marked Unverified with reason |
| P0-06 | Owner review of ADRs **[Done]** | 2 | Statuses confirmed in the register |
| P0-07 | Project board and Phase 1 issues **[Done]** | 1 | Board exists, issues created |
| P0-08 | Fill deadline, hours, dates **[Open]** | 1 | PROJECT_STATE and MVP plan updated |

## Phase 1: Engine and CLI

| ID | Item | Est | Acceptance |
|---|---|---|---|
| P1-01 | Gate spike: TypeScript module resolution accuracy **[Open (script ready)]** | 8 | Edges compared on 3 repositories against dependency-cruiser and Madge, disagreements hand-checked, result note, ADR 0004 validated or revised |
| P1-02 | IR and report schema v0 (Zod, JSON Schema) **[Built]** | 8 | Schema frozen, example report validates, round-trip tests |
| P1-03 | Fixtures with ground truth (at least 6 JS/TS, 2 Python, 1 mixed, 1 unsupported language, 1 hostile archive set) **[Built]** | 12 | Each fixture has expected.json, documented in fixtures/README |
| P1-04 | Acquisition: local path, GitHub archive, safe extractor, budgets **[Built]** | 12 | Malicious archive tests pass, budgets enforced, ADR 0003 validated |
| P1-05 | Detection and classification: languages, manifests, package managers, file kinds **[Built]** | 8 | Fixture truth matched, reasons recorded |
| P1-06 | JS/TS analyzer Level 3: imports, exports, symbols, resolution status **[Built]** | 20 | Edge precision and recall measured on fixtures |
| P1-07 | Graph: modules, SCC cycles, direction, fan-in and fan-out, instability **[Built]** | 10 | Cycle exact match on fixtures, deterministic output |
| P1-08 | Metrics: LOC, cyclomatic complexity, duplication **[Built]** | 10 | Matches fixture truth, documented method |
| P1-09 | Rules engine: YAML parser, evaluator, baseline, drift between two reports **[Built]** | 12 | Seeded violations found, no false positives on clean fixtures |
| P1-10 | Git analysis: churn, hotspots, ownership, shallow handling **[Built]** | 10 | Fixture git repos with known history match, limits reported |
| P1-11 | Security: OSV, Gitleaks, workflow checks, classification **[Built]** | 12 | Seeded fixtures detected, secrets redacted, offline state correct |
| P1-12 | Practices: CI, tests, lint, format, types, docs, ADR, license **[Built]** | 6 | Detectors match fixtures |
| P1-13 | Scoring engine with coverage and confidence per methodology **[Built]** | 8 | Not assessed paths tested, no zero for missing data |
| P1-14 | Report builders: JSON, Markdown, self-contained escaped HTML **[Built]** | 12 | Schema validation, hostile content escaped |
| P1-15 | CLI: analyze, rules check, report, baseline, exit codes, offline, progress **[Built]** | 10 | Exit code contract tested end to end |
| P1-16 | Python analyzer Level 2 (stretch to 3) **[Built (Level 2)]** | 14 | Fixture accuracy recorded (cut candidate) |
| P1-17 | Evaluation harness and Phase 1 results **[Built]** | 8 | docs/evaluation/results/phase-1.md published |
| P1-18 | Benchmarks on 5 public repositories **[Open (script ready)]** | 5 | Time, memory, coverage recorded with SHAs |

## Phase 2: Web platform

| ID | Item | Est | Acceptance |
|---|---|---|---|
| P2-01 | Gate spike: graph benchmark (1,000 and 5,000 nodes) | 6 | Numbers recorded, ADR 0012 accepted |
| P2-02 | Next.js app, design system, tokens, app shell, theme | 14 | Components match tokens, contrast checks pass |
| P2-03 | Postgres schema, migrations, docker compose | 6 | Local up with one command, migration rollback notes |
| P2-04 | API: submit, status, report, cancel, validation, basic rate limit | 10 | Contract tests, SSRF safe URL validation |
| P2-05 | Worker: pg-boss, lifecycle, budgets, cancellation, cleanup | 12 | End to end job on a 50k LOC repository |
| P2-06 | Landing, Analyze and configuration screens | 8 | All states implemented |
| P2-07 | Progress screen with real stages and cancel | 5 | Live region announcements, partial states |
| P2-08 | Overview page answering the five questions | 10 | UX acceptance for overview |
| P2-09 | Architecture explorer: graph, table, grouping, search, filters, drill-down | 20 | 1,000 node fixture smooth, keyboard usable |
| P2-10 | Quality, Security, Practices pages and finding detail | 14 | Evidence and limitations on every finding |
| P2-11 | Evolution page: hotspots, churn, ownership, limits | 8 | Shallow clone state shown |
| P2-12 | Rules page: validate, violations, baseline status | 8 | Valid and invalid YAML tested |
| P2-13 | Export UI: Markdown, JSON, HTML | 4 | Files match CLI output |
| P2-14 | History and comparison | 10 | Deltas computed from reports only |
| P2-15 | Polish: states, responsive, accessibility pass, Playwright journey | 12 | Axe clean, Lighthouse 95 or higher |

## Phase 3: Hardening and release

| ID | Item | Est | Acceptance |
|---|---|---|---|
| P3-01 | Threat model verification tests | 8 | T-01 to T-17 each have a test or documented exception |
| P3-02 | SSRF, archive fuzz, resource-limit tests | 8 | SA-02, SA-03, SA-09 pass |
| P3-03 | Rate limits, quotas, retention, deletion, privacy page | 8 | SA-08, SA-13 pass |
| P3-04 | Observability: structured logs, health, error tracking | 5 | RA-04 pass |
| P3-05 | Deployment: Vercel, worker, Postgres, runbooks, rollback | 10 | Rollback rehearsed once |
| P3-06 | Performance benchmarks and report | 6 | final results published |
| P3-07 | Final accuracy evaluation | 6 | Results with limitations |
| P3-08 | Usability test with at least 5 participants | 8 | SUS and task times recorded |
| P3-09 | Accessibility audit | 5 | No critical issues |
| P3-10 | Final documentation: README, methodology page, contributor docs | 8 | Clean-clone setup verified |
| P3-11 | Release: SBOM, license audit, changelog, tag v0.1.0 | 5 | SA-10, SA-11 pass |
| P3-12 | Demo kit and rehearsal | 4 | Script and fallback ready |
| P3-13 | Academic documents (after exit confirmation) | 30 to 50 | docs/academic complete from facts only |

## Later (post-MVP, not in the build)

Account and organization portfolio, private repository analysis on the hosted site, GitHub login,
coverage ingestion, license compatibility, flaky test signals, call graphs, framework-specific
architecture (Next.js conventions), Semgrep and Scorecard integrations, SBOM generation of analyzed
repositories, SSE progress, optional local model experiments, additional languages, VS Code extension.
