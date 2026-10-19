# ADR 0005: Versioned IR and report schema with Zod

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated by fixture round trips in P1-02

## Context

Engine, CLI, worker, and web must agree on data.

## Requirements and constraints

Backward compatibility, JSON Schema export, runtime validation of stored reports.

## Alternatives considered

A. Hand-written TypeScript types only.
B. Zod schemas as source of truth with generated JSON Schema.
C. Protobuf or JSON Schema first with code generation.

## Decision

Define the IR and report in Zod, export JSON Schema, version with semver, validate every report on write and on read.

## Rationale

One definition yields types, validation, and public schema with minimal tooling.

## Consequences and tradeoffs

Zod runtime cost on very large reports, mitigated by validating the envelope eagerly and large arrays in a streaming or sampled way if needed.

## Security and operational implications

Validation on read protects the UI from malformed or malicious stored reports. HTML export escapes all content.

## Validation plan

Contract test in Phase 2 ensures the web only uses published schema types.

## Conditions for reconsideration

If schema size or validation time becomes a bottleneck.
