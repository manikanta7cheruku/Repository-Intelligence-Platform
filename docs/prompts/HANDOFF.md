# Handoff: how to start Phase 2 or Phase 3 in a new chat

A new chat knows nothing about this project. It only knows what you give it. This page lists exactly what to give.

## Option A (best): use Claude Code inside the repository

1. Install Claude Code, open a terminal in your RepoLens repository (on `main`, Phase 1.5 merged, `pnpm check` green).
2. Start it and paste the prompt from `docs/prompts/phase-2-prompt.md` (or phase 3). The assistant reads `CLAUDE.md` and the `docs` folder itself and can run `pnpm check`.
3. Work branch by branch, as the prompt says.

## Option B: a normal chat (claude.ai)

The chat cannot see your repository, so attach files. Upload these, in this order (a zip of the whole `docs` folder plus the listed code files is fine if the chat accepts zips):

For Phase 2:

1. `CLAUDE.md` and `README.md`
2. `docs/PROJECT_STATE.md`
3. `docs/phases/phase-2-web-platform.md`, `docs/phases/phase-1-5-insight-upgrade.md`, `docs/phases/phase-1-engine-cli.md`
4. `docs/product/PRD.md`, `docs/product/use-cases.md`, `docs/product/product-spec.md`
5. `docs/ux/` (all files, especially `design-tokens.md`, `information-architecture.md`, `wireframes.md`, `states-and-accessibility.md`, `explanations-and-glossary.md`, `visual-direction.md`)
6. `docs/architecture/` (`overview.md`, `analysis-pipeline.md`, `ir-and-report-schema.md`, `job-model-and-caching.md`, `repository-structure.md`)
7. `docs/security/threat-model.md`, `docs/security/security-acceptance.md`
8. `docs/adr/` (all)
9. `docs/reference/` (all)
10. `docs/learning/phase-1-engine-cli.md`, `docs/learning/phase-1-5-insight-upgrade.md`
11. `docs/registers/decision-register.md`, `docs/roadmap/backlog.md`
12. `packages/core/schema/report.schema.json` and `packages/core/src/ir/types.ts` (the data contract)
13. `packages/core/src/glossary/glossary.ts` (every explanation the UI must show)
14. A real sample report: `repolens analyze . --offline -f json,html -o sample` then attach `sample/report.json` and `sample/report.html`
15. Optional screenshots of any UI inspiration you like (not to copy, to discuss)

For Phase 3 attach the same list plus `docs/phases/phase-2-web-platform.md` (final), `docs/learning/phase-2-web-platform.md`, `docs/evaluation/results/*`, `DOTEST.md` and the Phase 2 runbooks.

## What to type first (before the big prompt)

```text
I am the sole developer of an open-source project called RepoLens. I attached its documentation and data contract. Before you write anything, read the files in the order I listed,
then reply with: (1) a summary in your own words of what exists (phases 0, 1 and 1.5), (2) what you believe Phase 2 must deliver, (3) anything missing or contradictory in the files,
(4) the single most important question you need answered. Do not build anything yet. After I answer, I will paste the full Phase 2 prompt.
```

Then paste the full prompt. Checking the assistant's summary first is the cheapest way to make sure it understood the project.

## Keeping the chats connected

- At the end of every working session ask the assistant to update `docs/PROJECT_STATE.md` and the phase learning file, and commit them. The next chat starts from those files.
- When a chat gets long or confused, start a new one with HANDOFF Option A or B and the "resume" prompt of the current phase.
- Never rely on chat history as the source of truth. The repository and its docs are.
