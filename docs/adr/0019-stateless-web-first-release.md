# ADR 0019: Stateless web application for the first release

- Status: Proposed (owner approved the stateless direction on 2026-10-25, formal acceptance pending)
- Date: 2026-10-25
- Technical validation: end to end analysis of a public repository through `POST /api/analyze` (5.3 s for 267 files, measured locally). Hosting limits are unverified.
- Related: ADR 0002 (local first and worker), ADR 0006 (Postgres only), ADR 0009 (web stack), ADR 0011 (worker hosting, still open). This ADR supersedes ADR 0006 and the worker part of ADR 0002 **for the first release only**.

## Context

The original plan had a hosted worker, a Postgres queue, report storage, accounts and share links. For a sole developer with a free-tier goal this adds operations, privacy and abuse obligations before any user has seen the product.
The engine analyzes a typical public repository from a GitHub archive in seconds without cloning.

## Alternatives considered

A. Worker plus queue plus Postgres from the start (original plan).
B. Stateless: a serverless route runs the engine and streams the report, the browser stores it (IndexedDB), downloads are the sharing mechanism.
C. Browser-only analysis (not possible: the engine uses Node file and Git APIs).

## Decision

Option B. No database, no queue, no accounts, no server-side retention. A report can be saved as `report.json` and reopened. A worker (ADR 0011) is added only if measurements on the hosting plan show that real repositories do not fit.

## Rationale

Fewer moving parts, free to run, nothing to delete or protect on a server, and the privacy statement is short and true.

## Consequences and tradeoffs

- Reports are not shareable by link and exist only in the browser that made them (or in a downloaded file).
- No file level history for hosted analyses (GitHub API sample only). Local reports have it.
- Rate limiting is per server instance (in memory). It is a deterrent, not a guarantee.
- Large repositories may exceed the function time or memory limit. Budgets are set conservatively (40 MB archive, 8,000 files, 50 s).

## Security and operational implications

Only https `github.com` repositories, URL validation reused from the engine, body size limit, strict CSP, temporary files removed after each request, token read only from the environment.

## Validation plan

Deploy, run three repositories of different sizes, record time and memory, check current plan limits and bundle size, and record the date in `docs/evaluation/results/p2-00-feasibility.md`.

## Conditions for reconsideration

Repositories that exceed the limits, a need for shared links, or abuse that the in-memory limit cannot stop.
