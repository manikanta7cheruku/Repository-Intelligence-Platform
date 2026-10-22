# ADR 0016: Module inference rule and the scope of the dependency graph

- Status: Accepted (owner approved the Phase 1 build on 2026-10-21)
- Date: 2026-10-21
- Technical validation: validated on fixtures (ts-monorepo, py-package) and on this repository analyzing itself
- Related: ADR 0004, scoring methodology

## Context

Architecture statements need modules, but repositories do not declare them. The graph must also decide which
files count as architecture. Without clear rules, cycles and coupling numbers are noisy and unexplainable.

## Alternatives considered

A. Every directory is a module (too fine, thousands of nodes).
B. Only workspace packages are modules (too coarse for single-package repositories).
C. Package directory, plus an optional `src`, `lib` or `app` base, plus a configurable number of directory
   levels (default 1).
D. Learn modules by clustering the graph (non-deterministic, hard to explain).

## Decision

Use C. A module is the nearest ancestor directory that contains a package manifest (package.json,
pyproject.toml, setup.py), plus an optional `src`, `lib` or `app` segment, plus `moduleDepth` further directory
levels (default 1). Files directly in the base belong to the base module. The module origin is always
"observed" structure from the directory layout, and the UI must say that modules are inferred from directories.

The dependency graph contains production source files only (kind `source`, analyzed by a language analyzer).
Test, generated, vendored and documentation files are excluded. Fixtures are classified as test data.
Cycles include type-only edges but each cycle records `typeOnly` so consumers can discount it.

## Rationale

Deterministic, explainable, cheap, and good enough to expose real structure: the rule found a real
module cycle in this project's own source (configuration and barrel file sharing a directory), which was fixed.

## Consequences and tradeoffs

- Repositories with unusual layouts get coarse or fine modules. `moduleDepth` and a future explicit module
  map in the config are the escape hatches.
- Excluding tests hides test-to-test coupling, which is rarely an architecture concern.

## Security and operational implications

None beyond reading paths already inside the workspace.

## Validation plan

Fixture ground truth for module cycles (ts-cycle, ts-violation). Phase 3 usability test asks participants
whether module groupings match their mental model for 3 repositories.

## Conditions for reconsideration

If the usability test shows modules are misleading for common layouts, add an explicit module configuration
and language specific heuristics (for example Go packages).
