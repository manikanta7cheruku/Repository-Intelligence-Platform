# Scoring methodology (draft, frozen during Phase 1 task P1-13)

No score is shown without its inputs, formula, coverage, and confidence. Weights live in a profile
file, not in code. Scores that cannot be computed are "Not assessed" with a reason.

## 1. Principles

1. A score summarizes named sub-metrics. The user can always open the inputs.
2. Coverage is reported next to every score: analyzed files divided by analyzable files, per language, and which analyzers ran.
3. Confidence is derived from coverage and resolution rates, not guessed.
4. Thresholds come from published literature or from calibration on fixtures and public repositories, and are labeled as such.
5. Scores are never compared across different profiles without saying so.
6. Absence of findings never means "secure" or "good".

## 2. Dimensions

| Dimension | Purpose | Sub-metrics |
|---|---|---|
| Architecture | Structural health of dependencies | cycle ratio, layer violation ratio (if rules exist), distance from the main sequence (Martin), fan-in and fan-out outliers, unresolved import ratio |
| Maintainability | Ease of change | complexity distribution (share of functions above thresholds), duplication ratio, oversized module ratio, churn-weighted hotspot share |
| Security hygiene | Signals, not a verdict | known vulnerable dependency count by severity, secret findings, workflow risk findings, lockfile presence |
| Testing and CI | Process signals | test framework detected, test-to-source ratio, CI present, lint, format, type-check present, coverage report (only if ingested) |
| Documentation | Onboarding quality | README sections present, setup instructions, contribution guide, license, ADRs, docs directory |
| Maintenance activity | History signals | commit recency, release cadence, contributor concentration (bus factor signal) |

## 3. Sub-metric definitions (draft)

- **Cycle ratio**: files in non-trivial strongly connected components divided by files in the graph. Tarjan SCC. Range 0 to 1, lower is better.
- **Instability (I)**: Ce / (Ca + Ce) per module, where Ce is outgoing and Ca incoming dependencies. Abstractness is not computed for JS/TS in the MVP (no reliable signal), so the main-sequence distance is shown only where abstractness is defined and otherwise marked not assessed.
- **Unresolved import ratio**: unresolved internal imports divided by internal imports. High values lower confidence in every graph-based metric.
- **Cyclomatic complexity**: McCabe decision points per function. Reported as distribution. Thresholds (for example 10 and 20) are conventional and configurable, labeled as convention.
- **Duplication ratio**: duplicated lines in clone groups of at least N tokens divided by total analyzed lines, N configurable (default from the chosen tool).
- **Hotspot**: file with high change frequency and high complexity in the analyzed window (CodeScene-style idea, our own implementation). Normalized by percentile within the repository.
- **Ownership concentration**: share of commits (or lines) by the top author per module. Shown as a signal, never as a quality measure.

## 4. Aggregation

1. Each sub-metric is mapped to 0 to 100 with a monotonic piecewise-linear function defined in the profile.
2. Dimension score is the weighted mean of available sub-metrics. Weights are renormalized over available sub-metrics.
3. If available weight is under 50 percent of the dimension total, the dimension is "Not assessed".
4. No overall single number in the MVP. An optional overall view is a Later item and must be derived transparently from dimensions with the same rules.

## 5. Confidence

```
confidence = min(language_coverage, resolution_rate, history_completeness_if_used)
```

Mapped to High (at least 0.85), Medium (0.6 to 0.85), Low (under 0.6). Thresholds are provisional and recalibrated in P1-17.

## 6. Validation plan

1. Hand-built fixtures with known answers test each sub-metric.
2. Run on 5 or more public repositories and review the top results manually.
3. Publish a calibration note describing every threshold's origin.
4. Known limitations (dynamic imports, generated code, monorepo aliasing) are listed on the methodology page in the app.

## 7. Display rules

- Show the score, the coverage badge, the confidence label, and a "How this is calculated" link.
- Never show a gauge or color for Not assessed. Use a neutral state with the reason.
- Color is never the only signal. Pair with text and icon.
