# Decision and validation register

Statuses: Proposed, Under investigation, Validated, Confirmed, Rejected, Deferred.
Confirmed means the owner explicitly approved it. Validated means technically proven.
An item can be Confirmed without being Validated (approved, validation still pending).

## Decisions

| ID | Decision | Confirmed by owner | Validation | Evidence | Owner |
|---|---|---|---|---|---|
| D-01 | Local-first TypeScript monorepo (ADR 0001, 0002) | Confirmed 2026-10-19 | Pending P1 and P2 | Scaffold, V-01 to V-03 | Owner |
| D-02 | Safe acquisition via archives, hardened Git for history (ADR 0003) | Confirmed | Pending P1-04, P3-02 | Threat model | Owner |
| D-03 | TypeScript compiler API plus Tree-sitter (ADR 0004) | Confirmed | Partially validated (fixtures 1.0). Gate P1-01 on real repositories open | docs/evaluation/results/phase-1.md | Owner |
| D-04 | Versioned schema with semver (ADR 0005, Zod part amended by ADR 0015) | Confirmed | Validated (schema file, drift test) | packages/core/schema | Owner |
| D-05 | Postgres only, pg-boss (ADR 0006) | Confirmed | Pending P2 | n/a | Owner |
| D-06 | Transparent multi-dimension scoring, no LLM (ADR 0007) | Confirmed | Implemented, tested. Calibration on real repositories in Phase 3 | scoring-methodology.md | Owner |
| D-07 | Integrate OSV and Gitleaks, no custom SAST (ADR 0008) | Confirmed | Pending C-05, C-06, P1-11 | n/a | Owner |
| D-08 | Next.js, Radix, custom tokens (ADR 0009) | Confirmed | Pending P2-02 | docs/ux | Owner |
| D-09 | Apache-2.0 (ADR 0010) | Confirmed | Pending C-19, P3-11 | LICENSE | Owner |
| D-10 | Worker host (ADR 0011) | Not yet | Under investigation | C-15, C-16 | Owner |
| D-11 | Graph library (ADR 0012) | Not yet | Under investigation, gate P2-01 | n/a | Owner |
| D-12 | Account analysis deferred (ADR 0013) | Confirmed | n/a | Deferred | Owner |
| D-13 | Testing and tooling (ADR 0014) | Confirmed | Validated by CI in P0-03 once green | CI run | Owner |
| D-14 | Four-phase delivery for a sole developer, academic docs last | Confirmed 2026-10-19 | n/a | docs/phases | Owner |
| D-15 | Dependency-light core: hand-written schema validator and YAML subset instead of Zod and a YAML library (ADR 0015, amends ADR 0005) | Pending explicit owner confirmation (built with Phase 1) | Validated by 165 tests | docs/evaluation/results/phase-1.md | Owner |
| D-16 | Module inference rule and production-only graph (ADR 0016) | Pending explicit owner confirmation | Validated on fixtures and self-analysis, usability check in Phase 3 | fixtures, ADR 0016 | Owner |
| D-18 | One glossary and schema 0.2.0 for all explanations (ADR 0017) | Pending explicit owner confirmation | Validated by tests, usability check in Phase 3 | glossary tests | Owner |
| D-19 | Transparent risk index, rule-based PR verdict, evenly sampled trend (ADR 0018) | Pending explicit owner confirmation | Unit and Git tests pass, calibration in Phase 3 | tests | Owner |
| D-17 | Python analyzer is a lexical Level 2 parser, not Tree-sitter (deviation from ADR 0004 note) | Pending explicit owner confirmation | Validated on 2 fixtures | fixtures/py-* | Owner |

## Requirements traceability

Functional requirements FR-01 to FR-22 and nonfunctional NFR-01 to NFR-10 live in
`product/product-spec.md`. Each backlog item in `roadmap/backlog.md` must cite the requirement it
satisfies when its GitHub issue is created.

## Assumptions

| ID | Assumption | Status |
|---|---|---|
| A-01 | Free tiers suffice for a demo | Under investigation |
| A-02 | JS/TS and Python are the right first languages | Assumption |
| A-03 | TypeScript module resolution is accurate enough | Under investigation |
| A-04 | Vercel Hobby non-commercial terms fit the project | Verified limits, owner to confirm intent |

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-01 | Solo scope overload | High | High | Cut list, gates, timeboxes | Open |
| R-02 | Import resolution inaccuracy | Medium | High | Gate P1-01, report unresolved ratio, lower confidence. Fixtures 1.0, real repositories not yet measured | Open |
| R-03 | Free worker host unreliable | High | Medium | Fallback recording and local worker | Open |
| R-04 | Security flaw in hosted analysis | Medium | High | Threat model, acceptance tests, no code execution | Open |
| R-05 | Graph UI unusable at scale | Medium | High | Gate P2-01, default aggregation | Open |
| R-06 | License incompatibility | Low | Medium | Checklist C-19, CI license check | Open |
| R-07 | Unverified competitor claims | Medium | Medium | Research session, mark Unverified | Open |
| R-08 | Scores perceived as arbitrary | Medium | High | Methodology page, inputs, calibration | Open |

## Evidence log

| ID | Evidence | Location |
|---|---|---|
| E-01 | Vercel limits verified from vendor docs | research/verified-facts.md |
| E-02 | Fixture accuracy, 11 fixtures, precision and recall 1.0 | evaluation/results/phase-1.md |
| E-03 | 165 tests passing, TypeScript 6.0.3 strict typecheck | evaluation/results (this delivery), run `pnpm check` to reproduce |
| E-05 | Phase 1.5: 237 tests, 12 fixtures (blast radius ground truth), real Git tests for pr and trend | packages/core/src/**/*.test.ts |
| E-04 | Sandbox smoke benchmark | evaluation/results/sandbox-smoke.md |
