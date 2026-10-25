# Phase 1 accuracy results (fixtures)

Run date: 2026-10-24. Node v22.22.2. TypeScript 6.0.3.

Dataset: the hand-built fixtures in `fixtures/`. Ground truth was written by hand from the fixture source. The fixtures are small and written by the author of the tool, so these numbers show that the mechanisms are correct on known cases. They are not an estimate of accuracy on arbitrary real repositories.

## Aggregate (micro-averaged over all fixtures)

| Category | True positives | False positives | False negatives | Precision | Recall |
|---|---|---|---|---|---|
| edges | 45 | 0 | 0 | 1.000 | 1.000 |
| externals | 11 | 0 | 0 | 1.000 | 1.000 |
| unresolved | 3 | 0 | 0 | 1.000 | 1.000 |
| fileCycles | 3 | 0 | 0 | 1.000 | 1.000 |
| moduleCycles | 2 | 0 | 0 | 1.000 | 1.000 |

n/a means the category had no expected or no reported items.

## Per fixture

| Fixture | Edges TP/FP/FN | Externals TP/FP/FN | Unresolved TP/FP/FN | Cycles (file) | Cycles (module) | Exact checks |
|---|---|---|---|---|---|---|
| mixed-languages | 1/0/0 | 1/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| py-cycle | 4/0/0 | 0/0/0 | 1/0/0 | 1/0/0 | 0/0/0 | pass |
| py-package | 5/0/0 | 3/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| security-seeded | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-aliases | 7/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-blast-radius | 8/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-cycle | 8/0/0 | 0/0/0 | 0/0/0 | 2/0/0 | 1/0/0 | pass |
| ts-layered-clean | 6/0/0 | 3/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-monorepo | 3/0/0 | 1/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-unresolved | 1/0/0 | 2/0/0 | 2/0/0 | 0/0/0 | 0/0/0 | pass |
| ts-violation | 2/0/0 | 1/0/0 | 0/0/0 | 0/0/0 | 1/0/0 | pass |
| unsupported-only | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | pass |

## Limitations of this evaluation

- Author-built fixtures can share the author's blind spots.
- Fixtures contain no generated code, no unusual build tooling, and no very large graphs.
- Real repository benchmarks (time, memory, coverage) are recorded separately, see docs/evaluation/results.
