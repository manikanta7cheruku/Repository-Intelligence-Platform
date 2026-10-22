# Git flow for applying Phase 1

Goal: land Phase 1 the way a professional team would: small feature branches, Conventional Commits, one integration
branch, one pull request with CI, history preserved. The delivery zip contains a script that does the mechanical part.

## Branch model used

```text
main  ------------------------------------------------------------------>  (protected, always releasable)
  \                                                                  /
   phase/1-engine-cli  --- merge --- merge --- merge ... --- style --/   (integration branch, one PR)
        \                \          \
         feat/p1-02...    feat/p1-04  feat/p1-06 ...                    (one branch per backlog group)
```

| Branch | Backlog | Commit message |
|---|---|---|
| `chore/p1-00-tooling` | tooling | `chore: phase 1 workspace tooling and CI self-analysis` |
| `feat/p1-02-ir-schema-config` | P1-02 | `feat(core): intermediate representation, report schema, config and utilities` |
| `test/p1-03-fixtures` | P1-03 | `test: add fixtures with hand-written ground truth` |
| `feat/p1-04-acquisition` | P1-04 | `feat(core): safe repository acquisition` |
| `feat/p1-05-detection-practices` | P1-05, P1-12 | `feat(core): project detection and engineering practices` |
| `feat/p1-06-analyzers` | P1-06, P1-16 | `feat(core): JavaScript, TypeScript and Python analyzers` |
| `feat/p1-07-graph-metrics` | P1-07, P1-08 | `feat(core): dependency graph, cycles and metrics` |
| `feat/p1-09-rules-engine` | P1-09 | `feat(core): architecture rules engine and baselines` |
| `feat/p1-10-git-history` | P1-10 | `feat(core): Git history, hotspots and ownership` |
| `feat/p1-11-security-signals` | P1-11 | `feat(core): security signals (OSV, secrets, workflows)` |
| `feat/p1-13-findings-scoring` | P1-13 | `feat(core): findings, scoring and recommendations` |
| `feat/p1-14-pipeline-reports` | P1-14, P1-17 | `feat(core): analysis pipeline, reports and evaluation harness` |
| `feat/p1-15-cli` | P1-15 | `feat(cli): analyze, report, diff and schema commands` |
| `docs/p1-docs-scripts-learning` | docs | `docs: PRD, use cases, reference, learning guide, results and scripts` |

## Commands

Prerequisites: Git, Node 22 or newer, pnpm (via `corepack enable`), your repository cloned with a clean `main`, and your git identity set.

```bash
cd path/to/your/repolens
git switch main
git pull
git status                      # must be clean

# unzip the delivery next to your repository (it creates ../repolens-phase1)
unzip ../repolens-phase1.zip -d ..       # Windows: right click, Extract All

node ../repolens-phase1/apply-phase-1.mjs --dry-run    # shows the plan, changes nothing
node ../repolens-phase1/apply-phase-1.mjs              # does the work
```

The script creates the branches, commits and merges, then runs `pnpm install`, `pnpm format` (a separate `style:` commit) and `pnpm check`.
It never pushes. If `pnpm check` fails it stops and tells you, and you can fix the problem on the integration branch.

Then:

```bash
git log --oneline --graph -n 40          # review what happened
git push -u origin phase/1-engine-cli
```

On GitHub: open a pull request `phase/1-engine-cli` into `main`, wait for the CI check, read the diff once, and merge with **Rebase and merge**
(history stays readable) or **Create a merge commit**. Do not squash this one, it would erase the branch structure. Enable "Allow rebase merging" in
Settings, General, Pull Requests if needed. Afterwards:

```bash
git switch main && git pull
git branch -d phase/1-engine-cli
git branch | grep -E "feat/p1|chore/p1|test/p1|docs/p1" | xargs git branch -D     # local cleanup (optional)
```

## Doing it by hand (if you prefer or the script stops)

For each row of the table: `git switch -c <branch> phase/1-engine-cli`, copy that group's files from `../repolens-phase1/overlay` (same relative
paths), `git add -A`, `git commit -m "<message>"`, `git switch phase/1-engine-cli`, `git merge --no-ff <branch>`. The groups are listed in
`apply-phase-1.mjs`.

## Notes

- Each group builds on the earlier ones. Individual commits are intended to typecheck in order, but only the integrated pull request is verified by CI.
- For all later work (Phase 2 and 3) use plain feature branches and squash merges unless a phase is delivered in many pieces again.
- If you already changed files that the delivery overwrites, the script refuses to run on a dirty tree. Commit or stash first.
