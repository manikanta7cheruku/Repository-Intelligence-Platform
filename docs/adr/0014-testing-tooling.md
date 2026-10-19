# ADR 0014: Testing and tooling strategy

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated by CI in Phase 0 exit

## Context

Credibility depends on measured accuracy and repeatable quality gates.

## Requirements and constraints

Fast feedback, fixtures with ground truth, accessibility checks.

## Alternatives considered

A. Unit tests only.
B. Vitest unit and fixture tests, Playwright end to end, axe accessibility, Biome lint and format, CI gates.
C. Heavy contract and mutation testing from day one.

## Decision

Use option B. Fixtures with EXPECTED ground truth drive accuracy evaluation. CI runs lint, typecheck, test, build on every pull request.

## Rationale

Covers correctness, regressions, and quality at low cost.

## Consequences and tradeoffs

Fixtures take time to build, but they are the evaluation dataset and a major credibility asset.

## Security and operational implications

Dependabot, dependency review, secret scanning, and CodeQL default setup on the repository.

## Validation plan

CI green on main, coverage thresholds introduced in Phase 1.

## Conditions for reconsideration

If CI time exceeds 10 minutes, split jobs or cache more.
