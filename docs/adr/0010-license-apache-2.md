# ADR 0010: License: Apache-2.0

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Dependency license audit in P3-11

## Context

The project must be fully open source and welcome contributors.

## Requirements and constraints

Compatibility with dependencies, patent clarity.

## Alternatives considered

A. MIT (short, permissive, no patent grant).
B. Apache-2.0 (permissive, explicit patent grant, notice requirements).
C. Copyleft (AGPL or GPL).

## Decision

License all code under Apache-2.0 with a NOTICE file.

## Rationale

The patent grant and contributor clarity help adoption. It is compatible with MIT, BSD, ISC, and Apache dependencies.

## Consequences and tradeoffs

Slightly more paperwork than MIT. LGPL or GPL tools must be invoked as separate processes and never linked or bundled, and AGPL tools are avoided.

## Security and operational implications

SBOM and license check in CI from Phase 3.

## Validation plan

Run a license checker in CI and review each new dependency.

## Conditions for reconsideration

If a required dependency has an incompatible license.
