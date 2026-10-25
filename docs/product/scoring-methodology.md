# Scoring methodology (implemented in Phase 1, thresholds provisional)

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

## Implemented profile: default version 1.1.0

Generated from `packages/core/src/scoring/profile.ts` (profile hash 80e78573e2168d1e). A dimension is **not assessed** when less than 50 percent of its weight is available. Origin says whether a threshold is a widely used convention or a provisional choice that Phase 3 must calibrate on real repositories. Every input also has a glossary entry (`repolens glossary <input>`) with the meaning, the reason it matters and how to improve it.

### architecture

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| file-cycle-ratio | 0.35 | 0 to 100, 0.02 to 85, 0.1 to 50, 0.3 to 0 | provisional | Share of source files that sit in a runtime import cycle |
| module-cycle-ratio | 0.15 | 0 to 100, 0.1 to 70, 0.4 to 0 | provisional | Share of modules that sit in a module cycle |
| rule-violations-per-100-edges | 0.25 | 0 to 100, 1 to 80, 5 to 40, 15 to 0 | provisional | Architecture rule violations per 100 dependency edges (needs a rules file) |
| unresolved-import-ratio | 0.15 | 0 to 100, 0.02 to 90, 0.1 to 60, 0.3 to 0 | provisional | Internal imports that could not be resolved |
| high-fan-out-share | 0.1 | 0 to 100, 0.02 to 80, 0.1 to 30 | convention | Share of files importing more than 20 files |

### maintainability

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| high-complexity-function-share | 0.35 | 0 to 100, 0.02 to 80, 0.1 to 40, 0.25 to 0 | convention | Share of functions above the high complexity threshold |
| duplication-ratio | 0.3 | 0 to 100, 0.03 to 85, 0.1 to 50, 0.25 to 0 | provisional | Duplicated normalized lines divided by all normalized lines |
| oversized-file-share | 0.2 | 0 to 100, 0.05 to 80, 0.2 to 30 | convention | Share of source files above 500 code lines |
| hotspot-share | 0.15 | 0 to 100, 0.02 to 70, 0.1 to 20 | provisional | Share of files that are both frequently changed and complex (needs Git history) |

### security-hygiene

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| vulnerable-dependency-weight | 0.4 | 0 to 100, 2 to 80, 10 to 40, 30 to 0 | provisional | Known vulnerabilities weighted by severity (critical 10, high 5, medium 2, low 1) |
| secret-findings | 0.25 | 0 to 100, 1 to 50, 3 to 10, 5 to 0 | provisional | Possible committed secrets |
| workflow-risk-weight | 0.2 | 0 to 100, 2 to 80, 8 to 30, 15 to 0 | provisional | GitHub Actions risk findings weighted by severity |
| lockfile-present | 0.15 | 0 to 30, 1 to 100 | convention | A dependency lockfile exists |

### testing-ci

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| test-to-source-file-ratio | 0.25 | 0 to 0, 0.1 to 50, 0.3 to 90, 0.6 to 100 | provisional | Test files per source file. File presence is not test effectiveness |
| ci-present | 0.2 | 0 to 0, 1 to 100 | convention | A CI configuration exists |
| lint-or-format | 0.15 | 0 to 0, 1 to 70, 2 to 100 | convention | Linter and formatter configuration present |
| type-checking | 0.15 | 0 to 0, 1 to 100 | convention | A type checker is configured |
| line-coverage | 0.25 | 0 to 0, 0.3 to 40, 0.6 to 75, 0.8 to 95, 1 to 100 | provisional | Line coverage from an ingested coverage report (LCOV, Istanbul summary, Cobertura) |

### documentation

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| readme-completeness | 0.35 | 0 to 0, 100 to 100 | provisional | README exists (50), has setup section (25), has usage section (25) |
| community-files | 0.25 | 0 to 0, 5 to 100 | convention | Count of license, contributing, code of conduct, security policy, changelog |
| docs-and-decisions | 0.2 | 0 to 0, 2 to 100 | provisional | A docs directory (1) and architecture decision records (1) |
| setup-aids | 0.2 | 0 to 30, 1 to 70, 2 to 100 | provisional | Dockerfile, env example, Makefile, devcontainer |

### maintenance-activity

| Sub-metric | Weight | Curve (raw value to score) | Origin | Meaning |
|---|---|---|---|---|
| author-concentration | 0.5 | 0.3 to 100, 0.6 to 70, 0.9 to 30, 1 to 10 | provisional | Share of commits by the top author (continuity signal) |
| commits-per-month | 0.5 | 0 to 0, 1 to 30, 4 to 70, 10 to 100 | provisional | Commit density over the analyzed window (activity signal) |

### Explainability fields (schema 0.2.0)

- **Inputs used** (`weightCoverage`): available weight divided by total weight of the dimension.
- **Points to gain** (`impact` per input): `(100 - input score) x weight / available weight`, the most the dimension could rise if that input reached 100.
- **Development-only dependencies:** advisories for packages the lockfile marks as dev count at 40 percent in the vulnerability input.

### Coverage and confidence as implemented

| Dimension | Coverage used for confidence |
|---|---|
| architecture | minimum of structural coverage (analyzed source files divided by source files), the import resolution ratio, and a language level factor (code-line weighted: level 3 counts 1.0, level 2 counts 0.75) |
| maintainability | structural coverage |
| security-hygiene | share of the three checks (OSV, secrets, workflows) that ran |
| testing-ci, documentation | 1, or 0.8 when the analysis was truncated (these are file presence facts) |
| maintenance-activity | 0.6 for a GitHub API sample, 0.5 for shallow clones, 0.8 when the commit limit was reached, otherwise 1 |

Confidence: high at 0.85 or more, medium at 0.6 or more, otherwise low. Thresholds are provisional.

### Risk index (not a score dimension)

Per file, weighted mean of the available factors: complexity percentile 0.30, dependents percentile 0.25, change frequency percentile 0.25, test linkage or low coverage 0.20 (test linkage is 0 when a test imports the file, 0.5 when only reached indirectly, 1 when unreachable from tests, or 1 minus measured line coverage). Percentile is the share of files strictly below the value, so ties at zero score zero. At least two factors are required. Confidence is high with four factors, medium with three, low with two. It ranks files by cost of change. It does not predict defects.

### Known weaknesses of these scores

- Curves are provisional. They rank repositories sensibly on the fixtures but have not been calibrated on a large sample.
- Test presence is not test quality. Measured coverage is used only when a report is available.
- Python complexity is approximate. Python graphs are lexical (support level 2), which lowers architecture confidence.
- Security hygiene is a set of signals. A high score does not mean a repository is secure.
- No overall score exists on purpose.

