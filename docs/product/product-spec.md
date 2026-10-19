# Product specification

Status: Accepted by the owner (defaults approved 2026-10-19). Open items are listed at the end.

## 1. Problem

Developers and maintainers must understand unfamiliar or growing codebases, but existing tools split
the picture: SAST tools find vulnerabilities, quality dashboards give numbers without context, and
architecture tools need manual modeling. Few tools combine architecture discovery, quality, security
hygiene, practices, and history in one report that states what it observed, what it inferred, and how
reliable each conclusion is.

## 2. Vision and positioning

An open-source, explainable repository intelligence platform with a shared engine behind a CLI and a
web app. Positioning: trustworthy and evidence-based, strongest at architecture understanding and
architecture rules. It integrates established security scanners instead of competing with them.
Uniqueness is a hypothesis until the competitor matrix is verified (docs/research).

## 3. Personas

| Persona | Goal | Needs |
|---|---|---|
| Learner (student, new contributor) | Understand an unfamiliar repository quickly | Plain-language overview, where to start reading, entrypoints, structure, study-first file list |
| Maintainer (open-source or small team) | Protect architecture and quality over time | Rules and conformance, cycles, hotspots, baselines in CI, prioritized fixes |
| Evaluator (reviewer, hiring, instructor) | Judge a project fairly | Practices, maturity signals, coverage and limits of the analysis, exportable report |

## 4. Core journeys (MVP)

1. Learner pastes a public GitHub URL, waits for progress, reads the overview, opens the architecture explorer, follows the "start here" list.
2. Maintainer runs `repolens analyze .` locally, defines rules in `repolens.rules.yaml`, saves a baseline, enforces in CI with exit codes.
3. Evaluator exports an HTML report and compares two analyses of the same repository.

## 5. Functional requirements (MVP)

IDs are used in the decision register and backlog.

| ID | Requirement |
|---|---|
| FR-01 | Accept a public GitHub URL, local path, branch, tag, or commit |
| FR-02 | Safe acquisition with size, file-count, and time budgets (see threat model) |
| FR-03 | Detect languages, frameworks, package managers, manifests, lockfiles, build and test tools |
| FR-04 | Classify files (source, test, config, docs, generated, vendored) with reasons |
| FR-05 | JS/TS analysis at Level 3: imports, exports, symbols, dependency edges with resolution status |
| FR-06 | Python analysis at Level 2 (Level 3 stretch) |
| FR-07 | Honest partial report for unsupported languages (Level 1) |
| FR-08 | Dependency graph at file and module level, cycle detection, dependency direction, coupling and instability metrics |
| FR-09 | Entrypoint discovery for supported ecosystems (package.json scripts and bin, main fields, framework conventions) |
| FR-10 | Architecture rules in YAML, conformance checks, baselines, drift between two analyses |
| FR-11 | Metrics: LOC, cyclomatic complexity, duplication, oversized modules |
| FR-12 | Git history: churn, hotspots, ownership concentration, with shallow clone limitations stated |
| FR-13 | Security: OSV dependency matching, Gitleaks secrets, GitHub Actions workflow checks |
| FR-14 | Practices: CI, tests, lint, format, type checks, docs, README, ADRs, license, contributing |
| FR-15 | Scores per dimension with documented formulas, coverage, and confidence |
| FR-16 | Findings with stable id, severity, confidence, evidence, locations, remediation, limitations |
| FR-17 | Reports in JSON (schema versioned), Markdown, and self-contained HTML |
| FR-18 | CLI with profiles, baselines, offline mode, CI exit codes, progress, non-interactive mode |
| FR-19 | Web: submit, configure, progress with cancel, overview, architecture explorer, findings, evolution, rules, export |
| FR-20 | Web: history of analyses and comparison (same repo over time, two repos) |
| FR-21 | Template-based explanations generated from structured evidence (no LLM) |
| FR-22 | Reproducibility metadata in every report (tool version, schema version, commit SHA, config hash, timestamps, tool versions) |

## 6. Nonfunctional requirements

| ID | Requirement | Target (to be validated, not a claim) |
|---|---|---|
| NFR-01 | Determinism | Same input and config give byte-identical findings and graph (timestamps excluded) |
| NFR-02 | Performance | 50k LOC repository analyzed in under 60 seconds on a laptop (measure in Phase 1) |
| NFR-03 | Memory | Under 1.5 GB peak for the 50k LOC target |
| NFR-04 | Security | Repository code never executed, safe archive handling, SSRF protection (security-acceptance.md) |
| NFR-05 | Privacy | Local CLI sends nothing except optional OSV lookups, documented |
| NFR-06 | Accessibility | WCAG 2.2 AA for core flows |
| NFR-07 | Reliability | Partial results on partial failure, each analyzer isolated |
| NFR-08 | Compatibility | Report schema semver, additive changes within a major version |
| NFR-09 | Cost | Zero mandatory paid services for the MVP |
| NFR-10 | Explainability | Every score can be expanded to its inputs and formula |

## 7. MVP scope boundary

In: FR-01 to FR-22 as above, for public repositories on the hosted site and any local repository in the CLI.
Size target: up to about 50k lines per repository with budgets; larger repositories get partial analysis with stated limits.

## 8. Explicit exclusions (not in the MVP)

- Account and organization portfolio analysis (post-MVP, capped design is in ADR 0013 as Deferred)
- Private repositories on the hosted site (CLI handles private code locally)
- Call graphs, data-flow analysis, taint analysis
- Dynamic analysis, builds, dependency installation, test execution
- Machine learning features and LLM features
- Coverage ingestion, license compatibility, flaky test signals (backlog "Later")
- More than two analyzed languages at Level 2 or above
- Authentication beyond what the hosted demo needs (anonymous with rate limits; GitHub login is Later)
- Real-time collaboration, comments, teams, billing

## 9. Success criteria

1. Phase exit criteria in `docs/phases` all pass.
2. Fixture accuracy: dependency-edge precision and recall, cycle detection, and rule violations are measured and published, whatever the numbers are.
3. A new user can analyze a public repository and reach the architecture explorer in under 2 minutes of interaction (usability test).
4. At least 5 public repositories analyzed with recorded time, memory, and coverage.
5. Reproducible build from a clean clone documented and verified.

## 10. Assumptions and open items

| ID | Item | Status |
|---|---|---|
| A-01 | Free tiers (Vercel Hobby, managed Postgres, a free worker host) are enough for a demo | Unverified, decide worker host in Phase 2 |
| A-02 | JS/TS and Python cover the demo audience | Assumption |
| A-03 | The TypeScript compiler API resolves most imports accurately | To validate in P1-01 |
| A-04 | Vercel Hobby is acceptable for a non-commercial college project | Verified limits, owner to confirm non-commercial use stays true |
| Q-01 | Academic deadline and weekly hours | Open, owner to fill |
| Q-02 | Final product name | Open |
