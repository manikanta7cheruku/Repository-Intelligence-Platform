# Project state

Update this file at the end of every working session. A new AI chat can resume from this file alone.

## Snapshot

- Project: RepoLens (working name, rename allowed before first release)
- Owner and sole developer: (your name)
- Current phase: **Phase 1, Engine and CLI** (built, verified without network, owner live verification open)
- Last updated: 2026-10-21
- Academic deadline: (fill in, see docs/roadmap/mvp-plan.md)
- Weekly hours available: (fill in)
- Branch flow: feature branches merge into `phase/1-engine-cli`, then one PR into `main` (rebase and merge)

## Done

- Phase 0 complete (repo, CI, documentation, ADRs 0001 to 0014, threat model, UX direction, decision register).
- Phase 1 code complete: `packages/core` (about 5,600 lines) and `packages/cli`, 165 tests passing in the build environment, 11 fixtures with ground truth
  (precision and recall 1.0 on all categories), self-analysis with 0 rule violations, ADR 0015 and 0016, PRD and use cases, reference docs, learning files for phases 0 and 1.
- Verified: TypeScript 6.0.3 strict typecheck, Node 22 test run, fixture accuracy, schema validation of all generated reports, sandbox smoke benchmark.

## Not yet verified (owner tasks, see docs/phases/phase-1-engine-cli.md section 4 and 5)

- First real `pnpm install`, `pnpm format`, `pnpm check` (Biome and Vitest were not available in the build environment).
- Live GitHub download, live OSV lookups, Gitleaks binary, `--with-history` clone.
- Gate P1-01 comparison with Madge and dependency-cruiser on 3 real repositories.
- P1-18 benchmark on 5 public repositories.

## In progress

- Phase 1 owner checklist (apply with git flow, check, push PR, live verification).

## Next

- Finish the Phase 1 exit criteria, then paste the "start Phase 2" prompt from `docs/phases/phase-1-engine-cli.md` section 8.

## Open questions for the owner

1. Academic deadline and weekly hours.
2. Final product name (working name RepoLens).
3. Worker hosting choice (ADR 0011, decided at the start of Phase 2).
4. Confirm ADR 0015 (hand-written schema validator and YAML subset instead of Zod and a YAML library) and the Python lexical parser deviation noted in ADR 0004.

## Known risks right now

- Solo delivery of a large scope: keep the MVP boundary in `product/product-spec.md`.
- Competitor and license facts beyond Vercel are still Unverified (`research/verification-checklist.md`).
- Scores use provisional curves. Calibration on real repositories happens in Phase 3.
- Some of our own functions are highly complex (flagged by our own tool). Refactor in a later phase.
