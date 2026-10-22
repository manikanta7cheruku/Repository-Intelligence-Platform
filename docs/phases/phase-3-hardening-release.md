# Phase 3: Hardening and release

Estimated owner effort: 60 to 80 hours. Backlog items: P3-01 to P3-13.

## Goal

Turn the working MVP into a secure, observable, deployed, documented, evaluated v0.1.0 release with
honest measured results and a repeatable demo.

## Order of work

1. Security: P3-01 threat model verification tests, P3-02 SSRF, archive, and resource-limit tests.
2. Abuse and privacy: P3-03 rate limits, quotas, retention, deletion.
3. Operations: P3-04 observability, P3-05 deployment, runbooks, rollback.
4. Evidence: P3-06 performance benchmarks, P3-07 final accuracy evaluation, P3-08 usability test.
5. Quality: P3-09 accessibility audit, P3-10 final documentation and methodology pages.
6. Release: P3-11 SBOM, changelog, tag v0.1.0, P3-12 demo kit.
7. After exit confirmation: P3-13 academic documents.

## Exit criteria (MVP complete)

- [ ] Every item in `docs/security/security-acceptance.md` passes or has a documented, accepted exception
- [ ] No high severity open dependency vulnerabilities, no secrets in repository history
- [ ] Hosted site live on the chosen hosts, health checks green, rollback tested once
- [ ] Rate limits, job quotas, size and time budgets enforced and tested
- [ ] Retention and deletion work and are described on a public privacy page
- [ ] Evaluation results published in `docs/evaluation/results` with datasets and limits, no fabricated numbers
- [ ] Usability test done with at least 5 participants, results recorded
- [ ] Accessibility audit complete, no critical issues
- [ ] README, methodology, limitations, and contributor docs complete
- [ ] v0.1.0 tagged with SBOM and changelog, reproducible build instructions verified from a clean clone
- [ ] Demo script rehearsed with three demo repositories and a fallback recording

## Prompt: resume Phase 3 in a new chat

```text
Project: RepoLens. I am the sole developer. Read CLAUDE.md, docs/PROJECT_STATE.md,
docs/phases/phase-3-hardening-release.md, docs/roadmap/backlog.md, docs/security/*, and the decision
register. We are in Phase 3 (Hardening and release). Continue with the next unfinished item.
Treat gaps against the threat model as findings first. Plan briefly, implement, test, run pnpm check,
update PROJECT_STATE, and tell me exactly what to verify.
```

## Prompt: after MVP completion, generate the academic documents (only when I confirm all exit criteria)

```text
Project: RepoLens. The MVP is complete and v0.1.0 is released. I am the sole developer, but for
presentation the work is described as four workstreams (core engine and analyzers, graphs and
security and rules, web application and design system, CLI and infrastructure and testing).
Read docs/ fully, especially product, research, architecture, ADRs, security, evaluation results,
and docs/PROJECT_STATE.md.

Create the college major project documents in docs/academic/ in Markdown (reuse docs/learning, docs/product/PRD.md and docs/product/use-cases.md), using only facts that exist
in the repository and results we actually measured (no invented numbers):
1. Abstract (250 words) and keywords
2. Introduction, problem statement, objectives, scope and limitations
3. Literature survey and competitor analysis (from docs/research, with citations)
4. System analysis and requirements (functional, nonfunctional)
5. System design: architecture, IR, data model, UML-style diagrams (Mermaid), ADR summary
6. Implementation: modules, algorithms (graph cycles, metrics, scoring), security design
7. Testing and evaluation: methodology, datasets, results, limitations, threats to validity
8. Results and discussion, screenshots list to capture
9. Conclusion and future work
10. References
11. Four-workstream allocation statement and a presentation outline with speaker notes
12. Viva question bank (60 questions with model answers) based on the actual design decisions
No em dashes. Flag any section where evidence is missing instead of filling it.
```
