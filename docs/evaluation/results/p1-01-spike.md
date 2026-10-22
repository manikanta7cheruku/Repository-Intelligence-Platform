# Gate P1-01: import resolution accuracy on real repositories (owner task, not yet done)

Goal: decide whether ADR 0004 (TypeScript compiler API for JS/TS) is validated on real code by comparing RepoLens edges with
Madge and dependency-cruiser on three public repositories, and checking every disagreement by hand.

## Procedure

1. Pick 3 public JS/TS repositories of different style (for example a small library, an application with tsconfig paths, a pnpm monorepo). Clone each and note the commit SHA.
2. In each clone:
   ```bash
   node <repolens>/packages/cli/dist/index.js analyze . --offline --no-history -f json -o /tmp/rl
   npx madge --json --extensions ts,tsx,js,jsx src > /tmp/madge.json
   npx depcruise src --no-config --output-type json > /tmp/depcruise.json
   node <repolens>/scripts/compare-edges.mjs /tmp/rl/report.json /tmp/madge.json --prefix src
   node <repolens>/scripts/compare-edges.mjs /tmp/rl/report.json /tmp/depcruise.json
   ```
3. For every edge that appears in only one tool, open the importing file and decide who is right.
4. Fill the table below. A RepoLens error is a false positive (edge that does not exist) or false negative (missed edge).

## Results (fill in)

| Repository | Commit | Edges RepoLens | Edges Madge | Edges depcruise | Disagreements checked | RepoLens false positives | RepoLens false negatives | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Decision

Validated / Revised (write which). If revised, open a new ADR that supersedes ADR 0004 and add the failing case as a fixture.
Note: `scripts/compare-edges.mjs` was tested only on hand-written sample data, not on real Madge output. If Madge or dependency-cruiser change their
JSON format, adjust the script and record that here.
