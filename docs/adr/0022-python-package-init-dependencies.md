# ADR 0022: Python package imports depend on the package `__init__.py`

- Status: Proposed
- Date: 2026-10-25
- Technical validation: an independent check with Python's `ast` module on a real repository (717 import edges): before the change 613 of 717 edges (recall 0.855), after the change 717 of 717 with the same cycles. Fixture ground truth updated (two edges).
- Related: ADR 0004 (parsing strategy), ADR 0016 (module inference and graph scope)

## Context

The Python analyzer resolved `from pkg import name` to the file of `name` only. Python also runs `pkg/__init__.py` when a package is imported, so that file is a real dependency. Cycles that pass through `__init__.py` files were invisible, and a directory without `__init__.py` (a namespace package) was reported as unresolved.

## Decision

- `from pkg import name` depends on both the module that `name` resolves to and on `pkg/__init__.py` when it exists.
- A directory without `__init__.py` is a namespace package: names imported from it resolve to the modules inside it.
- A package never depends on itself.

## Consequences and tradeoffs

More edges, so more cycles can be reported in Python projects that re-export through `__init__.py`. Those cycles are real import cycles, although Python often tolerates them depending on import order. The Architecture score of such projects can drop. Reports made before this change are not comparable.

## Conditions for reconsideration

False cycles caused by `__init__.py` files that only re-export, reported by users on real projects.
