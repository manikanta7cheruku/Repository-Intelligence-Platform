# Sandbox smoke benchmark (not the official benchmark)

Purpose: a sanity check that analysis time and memory are in a plausible range. This is **not** the Phase 1
exit benchmark (P1-18), which must run on five public repositories chosen by the owner, on the owner's machine.

Each row was measured separately in one invocation per target (so Max RSS is per target). Environment: Linux x64 container, Node v22.22.2, TypeScript 6.0.3, offline mode, no Git history, three runs, median time.

| Target | Files | Code lines | Median ms | Max RSS MB (process so far) | Edges | Resolution ratio | Schema valid |
|---|---|---|---|---|---|---|---|
| This repository (`.`) | 368 | about 7,000 | 481 | 162 | 126 | 1.000 | yes |
| `react-dom` npm package (bundled JavaScript, 43 files) | 43 | 195,567 | 3,353 | 330 | 50 | 1.000 | yes |
| `pdf-lib` npm package (1,542 files) | 1,542 | 41,138 | 1,663 | 209 | 4 | 1.000 | yes |

What this shows: the engine handles a 195k line input in a few seconds and a few hundred megabytes in this
environment. What it does not show: behavior on typical source repositories with deep graphs, on Windows or macOS,
or with network features. The `react-dom` and `pdf-lib` rows are published npm packages (distribution code), not typical development source trees.
Treat these numbers as an upper-level sanity check only.

Reproduce: `pnpm build && node scripts/benchmark.mjs <target> --runs 3`.
