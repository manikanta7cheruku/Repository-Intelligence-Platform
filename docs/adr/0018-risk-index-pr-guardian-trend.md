# ADR 0018: Deterministic risk index, pull request guardian and trend analysis

- Status: Accepted (owner approved Phase 1.5 on 2026-10-22), confirm after DOTEST
- Date: 2026-10-22
- Technical validation: unit tests, fixture ground truth for blast radius, real Git repository tests for the guardian and trend
- Related: ADR 0007 (no machine learning), ADR 0003 (safe Git handling)

## Context

The product needs to answer "what is risky" and "did this change make things worse" without a trained model, a hosted service or executing project code.

## Alternatives considered

A. Train a defect prediction model (needs labeled data we do not have, not reproducible, not explainable).
B. A transparent weighted formula over measurable signals (complexity, dependents, change frequency, test linkage or coverage), with percentile ranks and published weights.
C. Only report raw metrics and leave interpretation to the reader.

For pull requests: (1) compare two saved reports, (2) analyze two Git refs using temporary detached worktrees, (3) install and run the project's own tooling (rejected: executes untrusted code).
For trend: analyze every commit (too slow) or evenly spaced commits (chosen).

## Decision

- Risk index: option B (weights 0.30, 0.25, 0.25, 0.20, at least two factors, confidence by factor count). It ranks files, it never claims to predict bugs.
- Blast radius: reverse reachability over the static import graph, with runtime-only reach separated from type-only reach, plus modules and entrypoints reached.
- Pull request guardian: compare a base and a head analysis made with the same configuration and rules. Verdict **regressed** on any new rule violation, new runtime cycle, new
  critical or high finding, or a drop of 3 or more points in architecture, maintainability or security hygiene. **Improved** when no regression and more findings resolved than added,
  a cycle removed or a score rose 3 or more points. Otherwise **unchanged**. Git refs are analyzed in detached worktrees created with the hardened git flags, validated refs, and removed afterwards.
  Offline by default (new vulnerabilities need `--online`).
- Trend: up to 15 evenly spaced first-parent commits, analyzed offline without history, secrets, workflows or vulnerabilities, reporting size, modules, edges, cycles, packages and scores plus drift.

## Rationale

Explainable, reproducible, free, and runnable on a laptop or in CI. Thresholds are published and arguable, which suits a research-style evaluation.

## Consequences and tradeoffs

- Weights and thresholds are provisional and must be calibrated in Phase 3 on real repositories (report what is learned).
- The verdict thresholds will flag some harmless changes and miss subtle ones. The report always lists the reasons so a human decides.
- Worktrees need a full enough clone to contain the base ref. In CI use `fetch-depth: 0` or fetch the base branch.

## Security and operational implications

No project code is executed. Refs are validated (no leading dash, no `..`, restricted characters). Worktrees live in the OS temp directory and are removed in a finally block (tested).
The user's working tree and branches are not modified (tested).

## Validation plan

DOTEST sections 4, 7 and 8 on Provenance. Phase 3: calibrate verdict thresholds and risk weights against a hand-labeled sample of changes from 5 public repositories and publish precision and recall of the verdict.

## Conditions for reconsideration

If calibration shows the risk index does not separate historically defect-prone files from others better than a single metric, simplify it or change the weights. Machine learning stays out until
a labeled dataset exists and a deterministic baseline is beaten with measured evidence.
