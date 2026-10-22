# ADR 0004: Parsing strategy by language

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Partially validated in Phase 1: 100 percent edge precision and recall on 11 hand-built fixtures, and 100 percent of internal imports resolved on this repository. Gate P1-01 (comparison with dependency-cruiser and Madge on 3 real public repositories) still needs network access and is an owner task, see docs/phases/phase-1-engine-cli.md
- Implementation note: Python uses a lexical import parser instead of Tree-sitter (support level 2). Tree-sitter remains the plan for additional languages.

## Context

Import resolution accuracy decides graph correctness.

## Requirements and constraints

JS/TS first, Python second. Add languages without core changes.

## Alternatives considered

A. Tree-sitter for everything.
B. TypeScript compiler API for JS/TS, Tree-sitter for Python and generic syntax.
C. Language servers for semantics.

## Decision

Use the TypeScript compiler API (parsing and module resolution, without type-checking the whole program) for JS/TS. Use Tree-sitter (WASM grammars) for Python and future languages. No language servers in the MVP.

## Rationale

The compiler API honors tsconfig paths, package exports, and extension rules, which hand-rolled resolvers get wrong. Tree-sitter is broad and fast for syntax-level extraction.

## Consequences and tradeoffs

Two parsing stacks to maintain. The compiler API adds a large dependency.

## Security and operational implications

Parsers handle hostile input, so run them with file size caps and time limits and treat crashes as per-file failures.

## Validation plan

P1-01 spike compares our edges with dependency-cruiser and Madge on 3 real repositories and hand-checks disagreements.

## Conditions for reconsideration

If the spike shows poor accuracy or unacceptable memory, evaluate oxc-parser or a custom resolver.
