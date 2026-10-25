# ADR 0020: Custom layered SVG graph rendering

- Status: Proposed (partially supersedes the default expectation in ADR 0012, which stays open for very large graphs)
- Date: 2026-10-25
- Technical validation: layout time 60 nodes 7 ms, 1,000 nodes 5 ms, 5,000 nodes 32 ms (synthetic graphs, Node). Rendering frame rate was not measured.
- Related: ADR 0012, ADR 0016

## Context

The main graphs are module level (tens of nodes), file level inside one module (capped at 70) and the impact neighborhood of one file (capped at 90). The engine already produces dependency levels, cycles and aggregated module edges.

## Alternatives considered

A. Cytoscape.js or Sigma.js (general purpose, force layouts, large bundle, accessibility work still ours).
B. A small custom layered layout rendered as SVG with `d3-zoom` for pan and zoom.
C. Server-rendered static images (not interactive).

## Decision

Option B. `lib/layout.ts` (longest-path layering after removing DFS back edges, barycenter ordering) and `components/layered-graph.tsx` (SVG, d3-zoom and d3-selection only). Large graphs are handled by aggregation and caps, not by drawing everything.

## Rationale

The dependency direction reads left to right, the layout is deterministic and testable, every node is a focusable element with a label (keyboard and screen reader friendly), and the same layout feeds the SVG export, so screen and download match.

## Consequences and tradeoffs

- SVG with hundreds of nodes is fine, thousands are not. The caps are the safeguard.
- No automatic force layout, no minimap, no edge routing around nodes (edges are curves and can cross nodes).
- If a use case needs an uncapped file level graph, benchmark Sigma.js (WebGL) and revisit.

## Security and operational implications

Labels come from untrusted repositories. They are rendered through React text nodes and escaped in exports. No HTML is injected.

## Validation plan

Measure frame rate on 90, 300 and 1,000 rendered nodes in a real browser and record it in `docs/evaluation/results/p2-graph-benchmark.md`.

## Conditions for reconsideration

Frame rate below 30 fps at the caps, or a requirement to show more than a few hundred nodes at once.
