# ADR 0007: Transparent scoring and deterministic explanations, no LLM

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Methodology validated on fixtures in P1-13 and P1-17

## Context

The product promise is trust and reproducibility. Paid LLM dependency is not allowed.

## Requirements and constraints

Explainable, reproducible, offline capable.

## Alternatives considered

A. Single opaque score.
B. Multi-dimension scores with named sub-metrics, coverage, confidence, and template explanations.
C. LLM generated explanations.

## Decision

Use the methodology in docs/product/scoring-methodology.md. Explanations are generated from templates over structured evidence. No machine learning in the MVP. Local models may be explored after release as optional.

## Rationale

Deterministic output is testable and trustworthy. Templates can reach useful quality when evidence is structured.

## Consequences and tradeoffs

Explanations are less fluent than LLM text. Mitigated by good templates and the evidence-first UI.

## Security and operational implications

No data leaves the user's machine for explanations.

## Validation plan

Review explanation templates with 5 users in the usability test (P3-08).

## Conditions for reconsideration

If a measured benefit from a local optional model appears with reproducible evaluation (docs prompt rules for ML features).
