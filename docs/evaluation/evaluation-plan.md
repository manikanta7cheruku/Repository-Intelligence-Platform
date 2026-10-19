# Evaluation plan

Publish whatever we measure. Never fabricate or round up results.

## Datasets

| Dataset | Content | Use |
|---|---|---|
| Fixtures | Hand-built repositories with ground truth: known edges, cycles, layer violations, vulnerable packages, fake secrets, risky workflows, hostile archives | Accuracy, regression |
| Public set | At least 5 public repositories of different sizes and styles (small library, mid-size app, monorepo, Python project, project with a known architecture doc), recorded by commit SHA | Performance, qualitative review |
| Baselines | dependency-cruiser and Madge outputs on the same JS/TS repositories | Edge comparison |

## Metrics

| Area | Metric | Method |
|---|---|---|
| Parsing and edges | Precision, recall, F1 of dependency edges | Compare to fixture ground truth and manually verified samples |
| Resolution | Resolved, external, unresolved rates | Computed |
| Cycles | Exact match on fixtures | Fixture truth |
| Rules | Detection of seeded violations, false positives | Fixtures |
| Security | Precision and recall on seeded issues | Fixtures |
| Architecture inference | Agreement with documented architecture on public repositories, rated by the owner with a written rubric (labeled as a small qualitative study) | Manual |
| Performance | Wall time and peak memory per repository, three runs, median | Script in scripts/ |
| Cache | Speedup on second run | Script |
| Reproducibility | Byte identical findings across 5 runs | Script |
| Scalability | Time versus LOC across the public set | Script |
| Usability | Time to reach the architecture explorer, task success, SUS score with at least 5 participants | Usability test |
| Usefulness | Participants rate recommendations on a 5 point scale | Usability test |

## Reporting

Each result file states dataset, commit SHAs, machine specs, tool versions, method, and limitations.
Results live in `docs/evaluation/results/`. Threats to validity are written explicitly (small samples,
author-built fixtures, participant selection).
