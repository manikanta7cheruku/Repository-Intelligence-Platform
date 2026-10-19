# ADR 0011: Worker hosting for hosted analysis

- Status: Proposed
- Date: 2026-10-19
- Owner approval: Decision at start of Phase 2
- Technical validation: Needs verification C-16

## Context

A container host is needed for the worker. Free options may sleep, restrict CPU, or change terms.

## Requirements and constraints

Zero mandatory cost for the demo, honest disclosure of limits, secure isolation.

## Alternatives considered

A. A free container platform tier.
B. A small VPS (low cost, owner approval needed).
C. Run the worker on the owner's machine for the demo with a tunnel.
D. A free cloud VM tier.

## Decision

Undecided. Default recommendation: develop with Docker Compose locally, and choose among A, B, D in Phase 2 after verifying current terms. Option C is the fallback for the live demo.

## Rationale

Terms and limits change often, so verify at decision time.

## Consequences and tradeoffs

A sleeping worker means cold start delays. UI must show a clear queued state.

## Security and operational implications

Worker has no inbound ports, only outbound to GitHub, OSV, and Postgres.

## Validation plan

Run the demo job set on the chosen host and record cold start and completion times.

## Conditions for reconsideration

Any change in free tier terms.
