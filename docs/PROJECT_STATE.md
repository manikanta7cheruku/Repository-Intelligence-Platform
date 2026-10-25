# Project state

Update this file at the end of every working session. A new AI chat can resume from this file alone.

## Snapshot

- Project: RepoLens (working name, rename allowed before first release)
- Owner and sole developer: (your name)
- Current phase: **Phase 1.5, Insight upgrade** (built and tested without network access, owner verification via DOTEST.md open)
- Last updated: 2026-10-22
- Academic deadline: (fill in, see docs/roadmap/mvp-plan.md)
- Weekly hours available: (fill in)
- Branch flow: integration branch per delivery (`phase/1-5-insight-upgrade`), feature branches merged with `--no-ff`, one PR, rebase and merge

## Done

- Phase 0 complete. Phase 1 complete and merged by the owner (engine and CLI, owner ran it on a real repository, Provenance, and reviewed the report).
- Phase 1.5 code complete: report fixes 1 to 12 from the Provenance review, glossary with five answers per term, executive summary, explainable scoring (inputs used, points to gain),
  risk index, blast radius (`impact`), pull request guardian (`pr`), trend (`trend`), coverage ingestion, commit quality and GitHub API activity, diagram exports (`graph`), schema 0.2.0,
  ADR 0017 and 0018, docs and learning files, Phase 2 and Phase 3 prompts, handoff guide.
- Verified in the build environment: TypeScript 6.0.3 strict typecheck, 238 tests on Node 22 (through a Vitest compatibility shim), fixture accuracy 1.0 on 12 fixtures including blast radius ground truth,
  self-analysis with 0 rule violations, apply script simulation.

## Not yet verified (owner tasks: DOTEST.md)

- `pnpm install`, `pnpm format`, `pnpm check` with the real Biome and Vitest after merging Phase 1.5.
- Provenance before and after (DOTEST sections 2 and 3), blast radius, diagrams, rules, PR guardian, trend on a real repository (sections 4 to 8).
- Coverage ingestion with a real coverage report, Gitleaks binary, GitHub rate limit behavior (sections 9 to 11).
- Gate P1-01 (comparison with Madge and dependency-cruiser) and P1-18 (5 repository benchmark) from Phase 1 if not done yet.

## In progress

- DOTEST verification and recording results in `docs/evaluation/results/p15-provenance.md`.

## Next

- Merge Phase 1.5, then start Phase 2 with `docs/prompts/phase-2-prompt.md` (see `docs/prompts/HANDOFF.md`).

## Open questions for the owner

1. Academic deadline and weekly hours.
2. Final product name (working name RepoLens).
3. Worker hosting choice (ADR 0011, decided at the start of Phase 2 after verifying current free-tier terms).
4. Confirm ADR 0015, 0016, 0017 and 0018.
5. Whether to enable GitHub OAuth for the optional "star from the site" flow (Phase 2).

## Known risks and debts

- Solo delivery of a large scope: keep the MVP boundary in `product/product-spec.md`.
- Risk index weights and PR verdict thresholds are provisional. Calibration is a Phase 3 work package.
- The tool flags our own largest functions (pipeline orchestrator, score engine, findings generator). Refactoring is Phase 3 (P3-09).
- Competitor and license facts beyond Vercel are still Unverified (`research/verification-checklist.md`).
