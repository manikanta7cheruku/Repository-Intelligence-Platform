# ADR 0008: Integrate established security tools, do not build SAST

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated in P1-11 against seeded fixtures

## Context

Security scanning is mature elsewhere. Our value is combining signals with context.

## Requirements and constraints

Open licenses, offline where possible, honest classification of findings.

## Alternatives considered

A. Build custom SAST.
B. Integrate OSV (dependencies), Gitleaks (secrets), own workflow checks, optional Semgrep later.
C. Integrate CodeQL.

## Decision

Use OSV for known vulnerable dependencies, Gitleaks for secrets, own checks for GitHub Actions workflow risks (for example unpinned actions, dangerous triggers, broad permissions). Semgrep is optional after license verification. CodeQL is excluded from the open core.

## Rationale

Avoids reinventing mature scanners and keeps licenses clean. Workflow checks are simple, high value, and deterministic.

## Consequences and tradeoffs

Depends on external binaries and the OSV API for online lookups. Offline mode reports dependency matching as not assessed unless a local database is provided.

## Security and operational implications

Secrets found are redacted in reports and logs. Tool output is parsed defensively. Findings are classified confirmed, probable, heuristic, or needs-manual-review. No finding set implies the repository is secure.

## Validation plan

Seed fixtures with known vulnerable packages, fake secrets, and risky workflows. Measure precision and recall.

## Conditions for reconsideration

If tool licenses change or maintenance stops (checklist C-05, C-06).
