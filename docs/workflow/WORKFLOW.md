# Workflow

## 1. Operating model

One developer, one AI collaborator. The AI plans, reviews, and writes code in small verified steps.
The owner approves decisions and runs every command locally. Work is organized in four phases:

| Phase | Name | Outcome |
|---|---|---|
| 0 | Foundation | Repo, tooling, CI, full planning documentation, decisions, threat model, UX direction |
| 1 | Engine and CLI | Working analysis engine and CLI producing JSON, Markdown, and HTML reports |
| 2 | Web platform | Production-quality web app, API, worker, database, architecture explorer |
| 3 | Hardening and release | Security hardening, evaluation, deployment, v0.1.0 release, final docs |

The MVP is complete only when Phase 3 exit criteria pass. After Phase 3, academic documents are written.

## 2. Tools

| Tool | Use |
|---|---|
| This chat (Claude web) | Planning, research with web search, design reviews, ADR decisions |
| Claude Code in the repo (recommended) | Implementation: it reads `CLAUDE.md` and `docs/` directly and runs `pnpm check` |
| GitHub | Source, issues, Projects board, Actions, Dependabot, private vulnerability reporting |
| Vercel | Web app hosting (Hobby is non-commercial) |
| Docker | Local Postgres and worker |

## 3. Session protocol (every working session)

1. Open `docs/PROJECT_STATE.md` and the current phase file.
2. Pick the next backlog item (`docs/roadmap/backlog.md`). Move it to In Progress on the board.
3. Paste the phase prompt (or the short session prompt below) into the AI.
4. Work in a branch. Small commits. Run `pnpm check` often.
5. Open a pull request even though you work alone (CI runs, history stays clean). Squash merge.
6. Update `docs/PROJECT_STATE.md`, the decision register, and ADRs if anything changed.
7. Close the backlog item only when its acceptance criteria are met.

### Short session prompt (use inside a phase)

```text
Continue RepoLens. Read docs/PROJECT_STATE.md, the current phase file, and the decision register.
Today's goal: <backlog item id and title>.
Follow CLAUDE.md rules. Plan first in a few lines, then implement in small steps with tests.
Run pnpm check. At the end, update docs/PROJECT_STATE.md and list what I must verify manually.
```

## 4. Git rules

- `main` is always releasable. Protect it: require pull requests and a passing CI check.
- Branches: `feat/`, `fix/`, `docs/`, `chore/`. Short lived (under 3 days).
- Conventional Commits. Squash merge.
- Tags: `v0.x.y` for releases. Changelog generated from commits in Phase 3.

## 5. Definition of done (any backlog item)

- Acceptance criteria in the backlog item are met.
- Tests cover the behavior, including a failure case.
- `pnpm check` passes in CI.
- No missing data displayed as zero. No em dashes in copy.
- Docs, ADR, and state file updated when behavior or decisions changed.

## 6. Decision rules

- Every major decision has an ADR. Accepted ADRs are never edited silently: write a new ADR that supersedes.
- Validated is not Accepted. The owner accepts.
- When evidence contradicts an ADR, stop and write a short "reconsideration note" in the ADR before changing course.

## 7. Scope control (solo rules)

- Timebox each backlog item. If it exceeds 2x its estimate, cut scope or defer it, and log it.
- Features not in `product/product-spec.md` MVP scope go to the backlog under "Later", not into the build.
- Depth beats breadth: one language at Level 3 with measured accuracy beats five languages at Level 1.

## 8. How phases chain together with prompts

Each phase file in `docs/phases/` contains:

1. Goal, scope, and tasks.
2. Exit criteria (what must be true to leave the phase).
3. The prompt to start or resume this phase.
4. The prompt to start the next phase. It begins with a recap of what was done before, then lists what to do now.

When a phase is finished: complete its exit checklist, update `PROJECT_STATE.md`, then paste the
"next phase prompt" into a new session.
