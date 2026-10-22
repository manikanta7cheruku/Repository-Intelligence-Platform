# Product Requirements Document (PRD)

Product: RepoLens (working name), an open-source repository intelligence platform.
Document owner: the project owner (sole developer). Version 1.0, 2026-10-21. Status: Approved for the MVP.
Related documents: [product-spec.md](product-spec.md), [use-cases.md](use-cases.md), [scoring-methodology.md](scoring-methodology.md), [../architecture/overview.md](../architecture/overview.md).

## 1. Summary

RepoLens analyzes a software repository and produces an evidence-based engineering report: structure,
dependencies, architecture rule conformance, quality, security signals, testing and CI practices, documentation,
and Git history. Every conclusion states what was observed, what was inferred, how reliable it is, and what
was not assessed. It runs as a CLI (local, offline capable) and as a web application, on one shared engine,
with no paid AI service.

## 2. Problem and opportunity

| Problem | Who feels it | Today |
|---|---|---|
| Understanding an unfamiliar codebase takes days | Students, new contributors, reviewers | Read files manually, grep, ad hoc diagrams |
| Architecture rules erode silently | Maintainers, small teams | Reviews, tribal knowledge, per-language tools that each cover one ecosystem |
| Quality dashboards give numbers without context | Everyone | Opaque scores, no evidence, no statement of what was skipped |
| Security scanners report findings but not posture, and quality tools ignore security | Maintainers | Several tools, several reports |

Opportunity: one explainable report whose strength is honesty (coverage, confidence, evidence) and
architecture understanding, built on established open-source scanners instead of replacing them.
Uniqueness is a hypothesis until the competitor matrix is verified (docs/research).

## 3. Goals and non-goals

Goals (MVP):
1. Produce a trustworthy report for a repository of up to about 50k lines in under one minute on a laptop (target, to be measured).
2. Make every finding traceable: id, severity, confidence, evidence, location, remediation, limitations.
3. Never present missing data as zero, never claim a repository is secure.
4. Same engine for CLI and web, deterministic output, versioned report schema.
5. Professional, accessible web experience (Phase 2).

Non-goals (MVP): account and organization portfolios, private repositories on the hosted site, call graphs,
dynamic analysis, executing repository code, machine learning, paid services, real-time collaboration.

## 4. Users and personas

| Persona | Context | Success looks like |
|---|---|---|
| Asha, final-year student | Joins an open-source project and must find where to start | Reads the overview, opens the architecture explorer, knows the first five files to read within 10 minutes |
| Marco, open-source maintainer | Wants to stop architectural drift without heavy tooling | Adds a rules file, runs the CLI in CI, sees violations with evidence, baselines legacy debt |
| Priya, reviewer or instructor | Evaluates many repositories fairly | Gets a comparable report with coverage and limits stated, exports it |

## 5. Scope by phase

| Capability | Phase 1 (CLI and engine) | Phase 2 (web) | Phase 3 (release) |
|---|---|---|---|
| Analyze local path or public GitHub URL | Delivered | Submit form, progress, history | Quotas, abuse limits |
| Reports (JSON, Markdown, HTML) | Delivered | Interactive viewer and export | Final polish |
| Architecture graph, cycles, rules, baseline, diff | Delivered | Architecture explorer, rules page, comparison | Usability tested |
| Security signals | Delivered (OSV needs live verification) | Findings pages | Hardened, tested |
| Scores with coverage and confidence | Delivered | Score explanations | Calibration notes |
| Git history | Delivered for local repositories | Evolution page | Remote history limits |
| Accessibility, responsive UI | n/a | Delivered | Audit |

## 6. Functional requirements and status after Phase 1

IDs match [product-spec.md](product-spec.md). Status: Done, Partial (explained), Planned (phase).

| ID | Requirement | Status | Notes |
|---|---|---|---|
| FR-01 | Accept GitHub URL, local path, branch, tag or commit | Done (CLI) | `--ref` accepts any ref the GitHub archive API accepts. Web in Phase 2 |
| FR-02 | Safe acquisition with budgets | Done | Safe tar extractor, size, count, time budgets, SSRF-safe URL parsing |
| FR-03 | Language, framework, package manager, manifest, lockfile detection | Done | Convention based, listed in the analyzers reference |
| FR-04 | File classification with reasons | Done | source, test, config, docs, generated, vendored, binary, other |
| FR-05 | JS and TS at Level 3 | Done | TypeScript compiler API resolution |
| FR-06 | Python at Level 2 | Done | Lexical import parser. Level 3 is Later |
| FR-07 | Honest partial reports | Done | Unsupported languages are Level 1, scores not assessed |
| FR-08 | Graph, cycles, direction, coupling | Done | Tarjan SCC, instability, levels. Abstractness is not computed |
| FR-09 | Entrypoint discovery | Done | Manifest fields and naming conventions only |
| FR-10 | Rules, conformance, baselines, drift | Done | Five rule types, JSON baseline, `diff` command |
| FR-11 | LOC, complexity, duplication | Done | Python complexity is approximate and labeled |
| FR-12 | Git history | Done (local) | Remote clone for history is implemented but needs live verification |
| FR-13 | OSV, secrets, workflow checks | Done | Live OSV and Gitleaks runs need owner verification |
| FR-14 | Practices detection | Done | Coverage reports are not ingested (Later) |
| FR-15 | Scores with documented formulas | Done | Six dimensions, no overall score |
| FR-16 | Findings model | Done | Stable ids, evidence, limitations |
| FR-17 | JSON, Markdown, HTML reports | Done | HTML has no scripts, strict CSP |
| FR-18 | CLI with profiles, baselines, offline, exit codes | Done | Profiles are config files. Incremental cache is Later |
| FR-19 | Web: submit, progress, explorer, findings, rules, export | Planned | Phase 2 |
| FR-20 | Web: history and comparison | Planned | Phase 2. The comparison engine (`diff`) exists |
| FR-21 | Template explanations | Done | Deterministic templates over structured evidence |
| FR-22 | Reproducibility metadata | Done | Tool versions, schema, config hash, input digest, content hash |

## 7. Non-functional requirements

See NFR-01 to NFR-10 in the product spec. Measured status after Phase 1:

| NFR | Status |
|---|---|
| NFR-01 Determinism | Verified by test: identical content hash across runs and file creation orders |
| NFR-02 Performance | Sandbox smoke result: a 195k line bundled JavaScript package analyzed in about 3.3 s. The official 5 repository benchmark (P1-18) is an owner task |
| NFR-04 Security | Safe extraction, SSRF-safe URL parsing, hardened Git flags and escaped reports are tested. Full acceptance list is Phase 3 |
| NFR-08 Compatibility | Schema 0.1.0 with a published JSON Schema and a drift test |
| NFR-10 Explainability | Every score lists its inputs, formula curve and notes in the report |

## 8. User experience requirements (Phase 2)

Defined in docs/ux. Key rules: the overview answers five questions on one screen, missing data is never zero,
every finding shows evidence and limitations, color is never the only signal, the graph has a table
alternative, WCAG 2.2 AA, no decorative UI, no em dashes in copy.

## 9. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Dependency edge precision and recall on fixtures | Published, whatever they are (currently 1.0 on 11 fixtures) | `pnpm eval` |
| Resolution ratio on public repositories | Reported per repository | Benchmark script |
| Time to first useful insight for a new user | Under 2 minutes of interaction | Usability test, Phase 3 |
| Reproducibility | Identical content hash across 5 runs | Test and benchmark script |
| False claims | Zero fabricated numbers in docs | Review before release |

## 10. Dependencies and constraints

Node 22, TypeScript compiler API, optional external tools (Gitleaks, Git), OSV.dev API (optional, online only),
GitHub archive API (rate limits, optional token), Vercel Hobby limits for the web tier (verified: 300 s, 2 GB, 4.5 MB bodies, non-commercial).
Sole developer, no mandatory paid service.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Import resolution inaccuracy on real repositories | Resolution ratio shown, confidence reduced, gate P1-01 spike, baseline against dependency-cruiser |
| Scores perceived as arbitrary | Inputs and curves shown, provisional labels, calibration notes in Phase 3 |
| Free hosting instability | Local-first design, recorded demo fallback |
| Scope growth | Cut list in the MVP plan |

## 12. Open questions

1. Final product name. 2. Academic deadline and weekly hours. 3. Worker hosting choice (ADR 0011). 4. Whether to publish the CLI to npm at v0.1.0.

## 13. Release plan

Phase 1 engine and CLI (this delivery), Phase 2 web platform, Phase 3 hardening and v0.1.0 release. After
the release: academic documents, then the Later list in the backlog.
