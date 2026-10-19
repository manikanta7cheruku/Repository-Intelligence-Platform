# Phase 2: Web platform

Estimated owner effort: 100 to 140 hours. Backlog items: P2-01 to P2-15.

## Goal

A production-quality web application on top of the Phase 1 engine: submit a public repository,
watch real progress, explore a professional report with an architecture explorer, export it, and
compare analyses.

## Scope

In: Next.js app on Vercel, Postgres (managed free tier), pg-boss queue, a Node worker container
running the same core, design system, all MVP screens, job budgets, cancellation, rate limiting
basics, report storage in Postgres JSONB, export, history, repository comparison.

Out: accounts and organizations portfolio (post-MVP), private repository analysis on the hosted site,
billing, teams, call-graph views.

## Order of work

1. Gate: P2-01 graph benchmark, accept or revise ADR 0012.
2. Foundation: P2-02 design system and app shell, P2-03 database, P2-04 API, P2-05 worker.
3. Screens in this order: submission and configuration (P2-06), progress (P2-07), overview (P2-08),
   architecture explorer (P2-09), findings (P2-10), Git evolution (P2-11), rules (P2-12),
   export (P2-13), history and comparison (P2-14), polish and states (P2-15).
4. After every screen: keyboard check, responsive check, state check (loading, empty, error, partial).

## Exit criteria

- [ ] Public repository URL submitted on the site produces a full report through the worker
- [ ] Progress reflects real job stages, supports cancel, and shows partial results on failure
- [ ] Overview answers the five questions in `docs/ux/information-architecture.md` within one screen
- [ ] Architecture explorer handles the 1,000 node fixture smoothly (documented frame rate) with grouping, search, filters, and a table alternative
- [ ] Every finding page shows evidence, location, confidence, limitations, remediation
- [ ] Reports export as Markdown, JSON, and HTML from the UI
- [ ] Two analyses of the same repository can be compared, and two repositories can be compared
- [ ] Rules page validates YAML and shows violations with evidence
- [ ] Automated accessibility checks (axe) pass on all core pages, keyboard-only path completes the main journey
- [ ] Lighthouse accessibility score 95 or higher on core pages (record the numbers)
- [ ] Web only consumes the versioned report schema, verified by a contract test
- [ ] Local `docker compose up` runs database and worker, documented in `docs/runbooks/local-dev.md`
- [ ] `pnpm check` green in CI, end to end test of the main journey passes (Playwright)

## Prompt: resume Phase 2 in a new chat

```text
Project: RepoLens. I am the sole developer. Read CLAUDE.md, docs/PROJECT_STATE.md,
docs/phases/phase-2-web-platform.md, docs/roadmap/backlog.md, docs/ux/*, and the decision register.
We are in Phase 2 (Web platform). PROJECT_STATE lists completed items. Continue with the next
unfinished item following docs/ux strictly. Plan briefly, implement, test, run pnpm check, update
PROJECT_STATE, and tell me exactly what to verify visually and with the keyboard.
```

## Prompt: start Phase 3 (paste when Phase 2 exit criteria are met)

```text
Project: RepoLens, open-source repository intelligence platform. I am the sole developer.
Read first: CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-3-hardening-release.md,
docs/security/*, docs/evaluation/evaluation-plan.md, docs/architecture/*, docs/registers/decision-register.md,
all ADRs, and results in docs/evaluation/results.

What we did before: Phase 0 built the repo, documentation, ADRs, threat model, and UX direction.
Phase 1 built the engine and CLI with fixture-based accuracy results. Phase 2 built the web app,
API, worker, database, design system, architecture explorer, findings, comparison, export, and
accessibility checks. The graph library decision (ADR 0012) and worker hosting decision (ADR 0011)
are made.

What we do now (Phase 3, Hardening and release): make the MVP production grade. Work through
P3-01 to P3-12: security verification against the threat model, abuse limits and retention,
observability, deployment with runbooks and rollback, performance and accuracy evaluation with honest
results, usability test, accessibility audit, final documentation, release v0.1.0 with SBOM, and demo
preparation. Start with P3-01 and report any threat-model gap as a finding before fixing it.
Do not write the academic documents until I confirm the exit criteria are met.

Plan briefly, implement, test, run pnpm check, update PROJECT_STATE, and tell me exactly what to run.
```
