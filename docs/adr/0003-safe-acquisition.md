# ADR 0003: Safe repository acquisition

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated by security tests in P1-04 and P3-02

## Context

Repositories are untrusted. Archives and Git configuration can be hostile.

## Requirements and constraints

No code execution. Size and time budgets. History needed for hotspots but costly and risky.

## Alternatives considered

A. Plain git clone with default config.
B. GitHub archive download via API for sources, hardened shallow or blobless Git only when history is requested.
C. GitHub REST commit API for history without cloning.

## Decision

Fetch source via GitHub archive endpoints with size caps and a custom safe extractor. For history use a hardened Git invocation (hooks disabled, no submodules, no filters that execute commands, no credential helpers, protocol allow-list) in an ephemeral workspace, with depth and time limits. Local analysis reads the working tree without running Git hooks.

## Rationale

The archive path avoids Git configuration attacks for the main analysis. History is optional and clearly marked limited when shallow.

## Consequences and tradeoffs

History features can be unavailable on the hosted site for large repositories. The report states why.

## Security and operational implications

Reject symlinks that escape the workspace, absolute paths, traversal, device files, and archives over size or ratio limits. Never follow redirects to non-allow-listed hosts.

## Validation plan

Unit tests with malicious archives (traversal, symlink, bomb). Fuzz extraction in Phase 3.

## Conditions for reconsideration

If the GitHub archive API changes limits, or a vetted sandboxed clone service becomes available.
