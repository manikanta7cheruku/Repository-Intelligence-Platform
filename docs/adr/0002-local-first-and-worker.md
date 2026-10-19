# ADR 0002: Local-first engine with a separate analysis worker

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Supported by verified Vercel limits V-01 to V-03; worker proven in Phase 2

## Context

The hosted site needs analysis of public repositories. Vercel Hobby functions are capped at 300 s, 2 GB, 4.5 MB bodies and Hobby is non-commercial.

## Requirements and constraints

Least complexity. No mandatory paid service. Untrusted input must not run on the web tier.

## Alternatives considered

A. All analysis in Vercel functions.
B. Local-first CLI plus a separate worker container for hosted jobs, web on Vercel.
C. Entire stack on one VPS.

## Decision

Run analysis in the CLI locally and in a separate worker for the hosted site. Vercel serves UI and thin API only.

## Rationale

Isolates untrusted processing from the web tier, avoids function limits, keeps CLI independent, and keeps private code local.

## Consequences and tradeoffs

Needs a worker host and a database. Free worker hosts may sleep or have terms that limit use, so the demo must tolerate cold starts.

## Security and operational implications

Worker runs with an unprivileged user, ephemeral workspace, no secrets beyond job needs, outbound allow-list where the host supports it.

## Validation plan

Phase 2 end-to-end test with a 50k LOC repository through the worker. Phase 3 load test within quotas.

## Conditions for reconsideration

If a managed option with safe sandboxing and acceptable cost appears, or the free worker host terms change.
