# Project state

Update this file at the end of every working session. A new AI chat can resume from this file alone.

## Snapshot

- Project: RepoLens (working name, rename allowed before first release)
- Owner and sole developer: (your name)
- Current phase: **Phase 1.5, Insight upgrade** (built and tested without network access, owner verification via DOTEST.md open)
- Last updated: 2026-10-25
- Academic deadline: (fill in, see docs/roadmap/mvp-plan.md)
- Weekly hours available: (fill in)
- Branch flow: integration branch per delivery (`phase/1-5-insight-upgrade`), feature branches merged with `--no-ff`, one PR, rebase and merge

## Done

- Phase 0 complete. Phase 1 complete and merged by the owner (engine and CLI, owner ran it on a real repository, Provenance, and reviewed the report).
- Phase 1.5 code complete: report fixes 1 to 12 from the Provenance review, glossary with five answers per term, executive summary, explainable scoring (inputs used, points to gain),
  risk index, blast radius (`impact`), pull request guardian (`pr`), trend (`trend`), coverage ingestion, commit quality and GitHub API activity, diagram exports (`graph`), schema 0.2.0,
  ADR 0017 and 0018, docs and learning files, Phase 2 and Phase 3 prompts, handoff guide.
- Verified on the owner's Windows machine (2026-10-25, Node 24.10.0, pnpm 10): `pnpm check` passes (Biome lint, build, typecheck, 238 tests in 33 files), `pnpm eval` has no failures, `pnpm analyze:self` exits 0.
  Smoke run of `analyze`, `impact`, `graph`, `trend` and `pr` on this repository worked; `pr --base "--upload-pack=x"` and a lookalike GitHub host are refused. Live network items in DOTEST.md (sections 2, 3, 9 to 11) are still unverified.
- Fixes made while verifying: lint warnings (optional chains, one test-only suppression), formatter drift, a Windows-invalid hostile file name in report tests (now `a'c&d.ts` on win32), and two files over the 700-line self-rule (`pipeline/files.ts` and `cli/help.ts` extracted). The count was 237 on first real run and is 238 after one added test.
- Academic docs added: `docs/academic/how-the-engine-reads-and-analyzes-code.md` and `docs/academic/viva-questions.md`.

- DOTEST sections 2 to 8 and 10 (built-in scan) were run on Provenance on 2026-10-25, see `docs/evaluation/results/p15-provenance.md`. Windows CRLF checkout caused 50 Biome format errors on `main`; fixed with `.gitattributes`.

## Not yet verified (owner tasks: DOTEST.md)

- Visual check of the HTML report and diagrams in a browser, and hand-checking blast radius and two OSV advisories.
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

- TypeScript 7 (native port) removes the JavaScript compiler API that `analyzers/js-ts.ts` uses (build fails with TS2694 on `CompilerOptions` and `ModuleResolutionCache`, seen in Dependabot PR 7). Major TypeScript updates are ignored in `.github/dependabot.yml` until the analyzer is ported or a stable programmatic API exists. `@types/node` majors are ignored while Node 22 is the supported runtime.
- Solo delivery of a large scope: keep the MVP boundary in `product/product-spec.md`.
- Risk index weights and PR verdict thresholds are provisional. Calibration is a Phase 3 work package.
- The tool flags our own largest functions (pipeline orchestrator, score engine, findings generator). Refactoring is Phase 3 (P3-09).
- Competitor and license facts beyond Vercel are still Unverified (`research/verification-checklist.md`).
