# ADR 0001: Monorepo with a TypeScript core

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated by scaffold build (pnpm check) in Phase 0 exit

## Context

One developer must ship an engine, CLI, web app, and worker. Shared types between engine and UI reduce integration cost.

## Requirements and constraints

Solo developer. Free tooling. CLI must work offline and independent of the hosted service.

## Alternatives considered

A. pnpm workspaces monorepo, TypeScript everywhere.
B. Python engine plus TypeScript web (two languages, duplicated schema).
C. Separate repositories per component.

## Decision

Use one pnpm workspace monorepo with TypeScript (strict) for core, CLI, web, and worker.

## Rationale

One language and one schema remove translation layers. Refactors across packages are atomic. TypeScript has strong tooling for JS/TS analysis (compiler API).

## Consequences and tradeoffs

Python analysis relies on Tree-sitter rather than Python's own ast module. Heavy CPU analysis in Node is slower than native tools, mitigated by integrating native binaries where it matters.

## Security and operational implications

A single lockfile and CI pipeline simplify supply-chain control. Dependency review in CI.

## Validation plan

Phase 1 benchmark: 50k LOC repository analyzed within the NFR-02 target.

## Conditions for reconsideration

If benchmarks show Node cannot meet targets for core graph or metrics work, move the hot path to a native component behind the same interface.
