# Information architecture

## Sitemap

```text
/                                  Landing (what it is, how it works, honest limits, CLI install)
/analyze                           Submit repository, configure, start
/analyses                          History of analyses
/analyses/:id                      Repository overview
/analyses/:id/architecture         Architecture explorer (graph, table, modules)
/analyses/:id/architecture/:module Module drill-down
/analyses/:id/quality              Quality and maintainability
/analyses/:id/security             Security findings and dependency health
/analyses/:id/practices            Testing, CI/CD, documentation, onboarding
/analyses/:id/evolution            Git history, hotspots, ownership, drift
/analyses/:id/rules                Architecture rules and conformance
/analyses/:id/findings/:findingId  Finding detail with evidence
/analyses/:id/export               Export options
/compare                           Compare two analyses or two repositories
/methodology                       Score formulas, thresholds, limitations
/docs                              CLI usage, rule file reference
/settings                          Theme, density, defaults
/privacy                           Data handling and retention
/portfolio                         Later (account-wide, post-MVP)
```

## Navigation

- Global left rail: Analyze, Analyses, Compare, Methodology, Docs, Settings.
- Inside an analysis: a tab bar (Overview, Architecture, Quality, Security, Practices, Evolution, Rules, Export) plus a persistent header with repository, ref, commit SHA, status, and a coverage badge.
- Breadcrumbs for drill-down. Global command palette (Cmd or Ctrl K) for jumping to files, modules, and findings.

## The five questions the overview must answer

| Question | Overview element |
|---|---|
| What is this project? | Identity strip: name, description, languages, frameworks, license, size, entrypoints |
| How is it structured? | Compact module map with top modules and layers, link to explorer |
| What are the most important findings? | Top findings table sorted by severity then confidence |
| How reliable is the analysis? | Coverage and confidence panel with per-language support levels and limitations |
| What should be fixed first? | Prioritized recommendations list with effort hints and evidence links |

## User journeys

1. Learner: Landing, Analyze, Progress, Overview, "Start here" files, Architecture explorer, Module drill-down.
2. Maintainer (web): Analyses, Overview, Rules, add rule, view violations, Export.
3. Maintainer (CLI): `repolens analyze`, view Markdown, enforce rules in CI, upload JSON to the web viewer (Later).
4. Evaluator: Overview, Methodology, Compare, Export.

## Page inventory (MVP)

Landing, Analyze, Progress, Analyses, Overview, Architecture, Module detail, Quality, Security, Practices,
Evolution, Rules, Finding detail, Export, Compare, Methodology, Docs, Settings, Privacy, 404, Error.
