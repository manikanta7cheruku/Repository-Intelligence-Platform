# ADR 0017: Report schema 0.2.0 and a single glossary for all explanations

- Status: Accepted (owner approved Phase 1.5 on 2026-10-22), confirm after DOTEST
- Date: 2026-10-22
- Technical validation: schema validation on every generated report in 238 tests, glossary completeness test
- Related: ADR 0005, ADR 0015

## Context

The first real report was correct but hard to read: terms like file-cycle-ratio meant nothing to a new reader, scores had no explanation of how to improve them, and
counts were misleading. The future web app and the HTML report both need the same plain-language explanations.

## Alternatives considered

A. Write explanations separately in the web app and in each renderer (drift guaranteed).
B. One glossary module in `packages/core` that every renderer and the web app import, with a version recorded in the report.
C. Fetch explanations from a remote service (breaks offline use).

## Decision

Use B. Every dimension, score input and key term has one entry with five answers: plain meaning, technical meaning, why it matters, how it is calculated, how to improve it.
A test requires an entry for every dimension and score input and forbids empty fields. The report records `methodology.glossaryVersion`. The schema moves to 0.2.0
(additive fields: file counts, executive summary, test coverage, risk, blast radius, history source and signals, score inputs used and points to gain, README sections).
Reports of version 0.1.0 are rejected by the 0.2.0 validator with a clear message, because the project is below 1.0 and no external consumers exist yet.

## Rationale

One source of truth prevents contradictions between CLI, HTML, Markdown and web. The glossary is also the teaching material for the college question bank.

## Consequences and tradeoffs

- Wording changes need a glossary version bump. The report records which version produced it.
- Old saved reports must be regenerated. Acceptable before 1.0.
- The web UI must render glossary text safely (it is static trusted text, but treat as data).

## Security and operational implications

Glossary text is static. Report text derived from repositories is still escaped by every renderer (tested).

## Validation plan

Phase 2 contract test: the web app displays every label through the glossary. Phase 3 usability test checks that participants understand at least 80 percent of terms from hover text alone.

## Conditions for reconsideration

If translations are needed, move the glossary to message catalogs keyed by id while keeping ids and the five-answer structure.
