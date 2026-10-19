# Low-fidelity wireframes (text)

## Overview

```text
+-------------------------------------------------------------------------------------+
| RepoLens | owner/repo  main @ 3fa9c2d  [Complete]  Coverage 87% (TS Level 3)  [Export] |
+--------+----------------------------------------------------------------------------+
| Nav    | Overview | Architecture | Quality | Security | Practices | Evolution | Rules |
|        +----------------------------------------------------------------------------+
|        | Identity: Next.js app, TypeScript 94%, MIT, 41k LOC, entry: src/index.ts   |
|        +--------------------------------------+-------------------------------------+
|        | Structure (module map, top 8)        | Analysis reliability                |
|        | ui > domain > data (observed)        | Coverage 87%  Confidence High       |
|        | [Open explorer]                      | Limits: dynamic imports not followed|
|        +--------------------------------------+-------------------------------------+
|        | Scores (with inputs link)                                                  |
|        | Architecture 74 High | Maintainability 68 Med | Security: signals only     |
|        | Testing and CI 81    | Documentation: Not assessed (reason)                |
|        +----------------------------------------------------------------------------+
|        | Top findings (severity, confidence, title, location)                       |
|        +----------------------------------------------------------------------------+
|        | Fix first (ranked) with evidence links                                     |
+--------+----------------------------------------------------------------------------+
```

## Architecture explorer

```text
+----------------------------------------------------------------------------+
| Search [____]  Group by [Directory v]  Level [Module v]  Filters [Cycles]   |
+---------------------------------------------------+------------------------+
| Graph canvas (collapsed groups by default)        | Detail panel           |
|  [ui] --> [domain] --> [data]                     | Module: src/domain     |
|    ^                       |                      | Origin: observed       |
|    +---- cycle -----------+                       | Ca 12  Ce 5  I 0.29    |
| Legend: observed, inferred, documented, cycle     | Dependencies (table)   |
+---------------------------------------------------+ Findings (2)           |
| [Graph] [Table]  table alternative for keyboard and screen readers          |
+----------------------------------------------------------------------------+
```

## Analyze

```text
Repository  [ https://github.com/owner/repo ]  Ref [ default branch v ]
Profile [Default v]   History [Include recent 500 commits v]
[ ] Include test files   Budgets: 60 MB, 20,000 files, 10 min (read only)
Notice: public repositories only on the hosted site. Use the CLI for private code.
[ Start analysis ]
```

## Progress

```text
Acquiring  done     Detecting  done     Analyzing  running (JS/TS 62%)
Scoring    waiting  Reporting  waiting   [Cancel]
Partial results appear as stages finish. Errors show the stage, reason, and what is still available.
```

## Finding detail

```text
RL-ARCH-CYCLE-3fa9c2  Circular dependency between 4 modules   Medium  Confidence High  Observed
Explanation (template) | Evidence: graph path (links) | Locations | Remediation | Limitations | Rule
```

## Rules

```text
Rule editor (YAML) with validation | Rules list | Violations table with evidence | Baseline status
```

## Compare

```text
Left analysis  vs  Right analysis (same repo over time or two repos)
Score deltas with inputs, new and resolved findings, dependency changes, drift summary
```
