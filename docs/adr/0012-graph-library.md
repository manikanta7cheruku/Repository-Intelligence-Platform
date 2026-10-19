# ADR 0012: Graph rendering library

- Status: Proposed
- Date: 2026-10-19
- Owner approval: Decision at gate P2-01
- Technical validation: Needs benchmark

## Context

The architecture explorer must stay usable with large graphs.

## Requirements and constraints

Grouping, collapse, search, filters, keyboard access, a table alternative.

## Alternatives considered

A. Cytoscape.js with ELK layout (rich features, canvas).
B. Sigma.js with graphology (WebGL, scales to large graphs, fewer built-in compound features).
C. D3 custom.

## Decision

Undecided. Benchmark A and B with 1,000 and 5,000 node fixtures, compare frame rate, memory, compound node support, and accessibility effort. Default expectation: Cytoscape.js with grouped collapsed nodes.

## Rationale

Measured numbers beat preference.

## Consequences and tradeoffs

Large graphs need aggregation regardless of library. Default view is module level, files appear on drill-down.

## Security and operational implications

No third-party scripts outside the bundle. Graph labels escaped.

## Validation plan

Benchmark script in scripts/ with results saved in docs/evaluation/results/graph-benchmark.md.

## Conditions for reconsideration

If real repositories exceed the benchmark assumptions.
