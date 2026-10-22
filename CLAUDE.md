# Project instructions for AI assistants

Read these files before doing any work, in this order:

1. `docs/PROJECT_STATE.md` (what is done, what is next)
2. The current phase file in `docs/phases/` and its learning file in `docs/learning/`
3. `docs/registers/decision-register.md` and the relevant ADRs in `docs/adr/`

Rules:

- Never change an accepted ADR silently. Propose a new ADR that supersedes it.
- Never execute code from analyzed repositories during static analysis.
- Never display missing data as zero. Use "not assessed" with a reason.
- Never invent metrics, benchmarks, or competitor capabilities. Cite sources or mark unverified.
- No em dashes in code comments, UI copy, or documentation. Use commas, colons, or parentheses.
- Keep changes small, tested, and tied to a backlog item in `docs/roadmap/backlog.md`.
- Update `docs/PROJECT_STATE.md` at the end of every working session, and keep the phase learning file accurate when behavior or design changes.
- Never claim a command was run or a result was measured unless it was. Mark anything unverified as unverified.
- Run `pnpm check` before declaring work complete.
