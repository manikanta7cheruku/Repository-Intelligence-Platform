# Git flow for applying Phase 1.5

Same method as Phase 1: an integration branch `phase/1-5-insight-upgrade`, one feature branch per delivery group, Conventional Commits, `--no-ff` merges, one pull
request, rebase-and-merge. The script never pushes and never touches `main`.

## Preconditions

1. Phase 1 is merged into `main` and CI is green.
2. `main` is clean and up to date: `git switch main && git pull && git status`.
3. Node 22 or newer, pnpm via `corepack enable`, git identity set.

## Commands

```bash
cd path/to/your/repolens
unzip ../repolens-phase1-5.zip -d ..              # creates ../repolens-phase1-5
node ../repolens-phase1-5/apply-phase-1-5.mjs --dry-run
node ../repolens-phase1-5/apply-phase-1-5.mjs
```

The script first compares each file it would overwrite with the Phase 1 version it was built from. If you changed a file (beyond formatting) it saves your version
to `../repolens-phase1-5-backups/<path>` and lists it, so you can re-apply your fix after the merge. Then it creates the branches, runs `pnpm install`, `pnpm format`
(a separate `style:` commit) and `pnpm check`.

```bash
git log --oneline --graph -n 40
git push -u origin phase/1-5-insight-upgrade
```

Open a PR into `main`, wait for CI, merge with **Rebase and merge** (or a merge commit, not squash). Then:

```bash
git switch main && git pull
git branch -d phase/1-5-insight-upgrade
```

## Branches

| Branch | Content |
|---|---|
| `chore/p15-00-tooling` | Package version, CI, DOTEST, package metadata |
| `feat/p15-01-schema-glossary` | Schema 0.2.0, glossary, semver helper |
| `feat/p15-02-security-quality` | OSV grouping and dev weighting, README detection, coverage ingestion, function names |
| `feat/p15-03-git-insight` | Commit quality, GitHub activity, worktrees, history stats |
| `feat/p15-04-risk-blast` | Blast radius, risk index |
| `feat/p15-05-scoring-findings` | Score improvements, new findings, recommendations |
| `feat/p15-06-reports` | Executive summary, diagrams, Markdown and HTML |
| `feat/p15-07-pipeline-pr-trend` | Pipeline wiring, PR guardian, trend, snapshots |
| `feat/p15-08-cli` | New CLI commands |
| `docs/p15-docs-prompts` | Phase 1.5 docs, ADRs, learning, Phase 2 and 3 prompts, handoff |

Note: the groups build on each other and the new report fields are used by the pipeline, so intermediate commits are layered and may not typecheck on their own. Only the integrated branch (and the pull request CI) is verified.

If you prefer to merge by hand: for each row `git switch -c <branch> phase/1-5-insight-upgrade`, copy the files of that group from the `overlay` folder, commit, merge with `--no-ff`.
