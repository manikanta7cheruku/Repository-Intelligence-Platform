# ADR 0013: Account and organization analysis deferred

- Status: Deferred
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Revisit after v0.1.0

## Context

Account-wide analysis needs pagination, rate limits, partial permissions, budgets, and larger compute.

## Requirements and constraints

Solo developer, free hosting, a defined MVP.

## Alternatives considered

A. Full account analysis in the MVP.
B. Capped account inventory plus selected repositories.
C. Defer entirely.

## Decision

Defer. Post-MVP design: discover repositories with pagination, user-selected subset, per-repository jobs with budgets, aggregate portfolio view that separates repository and account conclusions.

## Rationale

Protects the MVP and keeps the quality of single-repository analysis high.

## Consequences and tradeoffs

Portfolio screens are out of the MVP but remain in the information architecture as planned.

## Security and operational implications

Private repositories require a limited-scope GitHub App and explicit consent, designed later.

## Validation plan

Revisit with real usage and capacity numbers after release.

## Conditions for reconsideration

When single repository analysis is stable and hosting capacity is known.
