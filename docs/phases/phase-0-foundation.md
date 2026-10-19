# Phase 0: Foundation

Status: scaffold delivered, owner checklist open.
Estimated owner effort: 15 to 25 hours.

## Goal

Everything needed to build fast and safely: repository, tooling, CI, full planning documentation,
accepted decisions, threat model, UX direction, and the prompts that drive Phases 1 to 3.

## What was already produced

- Monorepo scaffold (pnpm workspaces, TypeScript strict, Vitest, Biome, CI, Dependabot, templates)
- Product specification, scoring methodology draft, evaluation plan
- Architecture overview, IR and report schema draft, job model, repository structure
- ADRs 0001 to 0014 (accepted by the owner, pending technical validation where noted)
- Threat model and security acceptance criteria
- UX direction, information architecture, wireframes, design tokens, states, accessibility rules
- Decision register, MVP plan, prioritized backlog with estimates
- This phase set with prompts

## Owner checklist (do these in order)

### Step 1: Install prerequisites (once)

| Tool | Version | Check |
|---|---|---|
| Git | any recent | `git --version` |
| Node.js | 22 or newer | `node -v` |
| Corepack (ships with Node) | n/a | `corepack enable` |
| Docker Desktop | needed from Phase 2 | `docker --version` |
| VS Code (suggested) | n/a | install the Biome extension |

### Step 2: Place the project

1. Unzip `repolens.zip` somewhere short, for example `D:\projects\repolens` or `~/projects/repolens`.
2. Open a terminal in that folder.

### Step 3: First install and check

```bash
corepack enable
pnpm install
pnpm check
```

Expected: lint, typecheck, tests (3 passing), and build all succeed.

Troubleshooting:
- If pnpm says build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` if listed.
- If `pnpm@10.0.0` cannot be found, run `corepack use pnpm@latest`, then commit the changed `packageManager` field.
- If Biome reports a config schema error, run `pnpm dlx @biomejs/biome migrate --write` and commit.
- If lint complains about formatting, run `pnpm format` once.

Commit the generated `pnpm-lock.yaml`. CI uses `--frozen-lockfile`, so it must exist.

### Step 4: Create the GitHub repository

1. On GitHub create a new **public** repository (name your choice, no README, no license, no .gitignore).
2. In the project folder:

```bash
git init -b main
git add .
git commit -m "chore: phase 0 foundation scaffold"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

3. Open the Actions tab and confirm the CI workflow is green.

### Step 5: Repository settings (GitHub, Settings)

| Setting | Where | Value |
|---|---|---|
| Branch protection for `main` | Rules, Rulesets | Require pull request, require status check "check", block force pushes |
| Private vulnerability reporting | Code security | Enable |
| Dependabot alerts and security updates | Code security | Enable |
| Secret scanning and push protection | Code security | Enable |
| Code scanning | Code security | Default setup (CodeQL is free for public repositories) |
| Squash merge only | General, Pull Requests | Enable squash, disable merge commits |
| Delete head branches on merge | General | Enable |

### Step 6: Project board and labels

1. Create a GitHub Project (Board layout) with columns: Backlog, Ready, In Progress, Review, Done.
2. Create labels: `phase-0`, `phase-1`, `phase-2`, `phase-3`, `later`, `bug`, `enhancement`, `accuracy`, `security`, `ux`, `docs`.
3. Create one issue per backlog item in `docs/roadmap/backlog.md` for the current phase only (create later phases when you reach them).

### Step 7: Fill the personal fields

Edit `docs/PROJECT_STATE.md`: your name, academic deadline, weekly hours. Edit `docs/roadmap/mvp-plan.md`
and convert effort estimates into dates working backward from the deadline.

### Step 8: Verify the unverified facts (research session)

Open a new Claude chat with web search enabled and run the **Research prompt** below. It fills
`docs/research/competitor-matrix.md` and `docs/research/verified-facts.md`. Review every row yourself.
Anything the AI cannot source stays marked Unverified.

### Step 9: Review the ADRs

Read `docs/adr/`. For each ADR either keep Accepted or change status to Rejected or Proposed and tell the
AI in the next session. Update `docs/registers/decision-register.md`.

### Step 10: Choose the final name (optional now, required before release)

If you rename, search and replace `repolens` and `RepoLens` across the repo and check the npm and GitHub namespaces.

## Exit criteria for Phase 0

- [ ] `pnpm check` passes locally and in CI on `main`
- [ ] Repository public with protections and security features enabled
- [ ] Project board created with Phase 1 issues
- [ ] Competitor matrix and verification checklist completed or explicitly marked Unverified with reason
- [ ] All ADRs reviewed by the owner
- [ ] `PROJECT_STATE.md` updated with deadline, hours, and dates in the MVP plan
- [ ] Phase 1 start prompt copied into a new session

## Prompt: run the research session (Phase 0, Step 8)

```text
You are my research assistant for the open-source project RepoLens (repository intelligence platform).
Web search is enabled. Read the attached docs/research/competitor-matrix.md and
docs/research/verification-checklist.md.

Task: verify every item using official documentation and actual source repositories only.
For each tool in the matrix, find: official repository URL, license (SPDX id and any restrictions on
rules, data, or hosted use), last release date and recent commit activity, supported languages, whether
it offers architecture analysis, code quality, security, Git history analysis, custom rules, CLI and CI,
and its deployment model. Then work through the verification checklist.

Rules:
- Cite a source URL and the access date for every claim. If you cannot verify, write "Unverified".
- Never invent capabilities, versions, or licenses.
- No em dashes.
- Output two Markdown files I can paste: competitor-matrix.md (completed) and verified-facts.md (updated).
- End with: (1) what we should build, reuse, integrate, or exclude, (2) licensing risks for an
  Apache-2.0 project, (3) honest differentiation opportunities, with evidence or marked as hypothesis.
```

## Prompt: resume Phase 0 in a new chat (if you lose context)

```text
I am the sole developer of RepoLens, an open-source repository intelligence platform (working name).
Read docs/PROJECT_STATE.md and docs/phases/phase-0-foundation.md.
We are in Phase 0 (Foundation). Everything in the owner checklist marked done in PROJECT_STATE is complete.
Help me finish the remaining checklist items one at a time. Give exact commands and where to run them.
Do not start Phase 1 until the exit criteria are all checked.
```

## Prompt: start Phase 1 (paste this when Phase 0 exit criteria are met)

```text
Project: RepoLens, an open-source repository intelligence platform. I am the sole developer.
Read first: CLAUDE.md, docs/PROJECT_STATE.md, docs/phases/phase-1-engine-cli.md,
docs/architecture/overview.md, docs/architecture/ir-and-report-schema.md, docs/product/product-spec.md,
docs/product/scoring-methodology.md, docs/registers/decision-register.md, and all ADRs.

What we did before (Phase 0): created the monorepo (pnpm, TypeScript strict, Vitest, Biome, CI),
wrote the full specification, architecture, 14 ADRs, threat model, UX direction and design tokens,
evaluation plan, and the backlog. All defaults were approved by me. Repo, CI, branch protection, and
security features are set up and green. External facts were verified in the research session and
unverified items are flagged.

What we do now (Phase 1, Engine and CLI): build the analysis engine in packages/core and the CLI in
packages/cli to the exit criteria in the Phase 1 file. Start with the gate task P1-01 (module
resolution spike) and stop to show me results before continuing. Then work through the backlog items
P1-02 onward in order, one at a time, with tests against fixtures and measurable acceptance criteria.

Rules: follow CLAUDE.md. Plan in a few lines, implement in small steps, run pnpm check, update
docs/PROJECT_STATE.md and the decision register at the end of each session, tell me exactly what I
must run or verify manually. Do not expand scope beyond the MVP boundary. Ask me at most one
focused question at a time and propose a default.
```
