# ADR 0015: Dependency-light core (hand-written schema validator and YAML subset)

- Status: Accepted (owner approved the Phase 1 build on 2026-10-21, review again in Phase 2)
- Date: 2026-10-21
- Owner approval: approved with the Phase 1 delivery, please confirm explicitly during the Phase 1 review
- Technical validation: validated by 165 automated tests, see docs/evaluation/results/phase-1.md
- Amends: ADR 0005 (Zod) and the rules file format in the architecture overview (YAML)

## Context

ADR 0005 chose Zod for the schema and the plan assumed a YAML library for rules. Phase 1 was built in an
environment where third-party packages other than TypeScript could not be installed or verified, and the
engine is a security sensitive component that parses untrusted data. Every runtime dependency is also a
supply-chain risk (threat T-14) and a license to audit (ADR 0010).

## Requirements and constraints

- Runtime schema validation of every report on write and on read (ADR 0005 goal).
- A published JSON Schema for external consumers.
- Rules files in a human friendly format.
- Fewest possible runtime dependencies for the engine.
- Everything must be fully testable.

## Alternatives considered

A. Zod as the single source of truth and a YAML library for rules (original plan).
B. TypeScript interfaces for compile time safety, one JSON Schema object as the runtime contract, a small
   validator for the JSON Schema subset the project uses, and a parser for a documented YAML subset.
C. No runtime validation.

## Decision

Use option B. `packages/core/src/ir/schema.ts` holds the JSON Schema (draft 2020-12 subset). A 60 line
validator interprets it and adds the invariants JSON Schema cannot express (not assessed scores have a null
value and a reason, ratios are null when there is no denominator). The JSON Schema file
`packages/core/schema/report.schema.json` is generated from the same object and a test fails if they drift.
Rules and config files use a YAML subset (maps, lists, inline lists, scalars, comments) with explicit errors
for unsupported constructs. JSON is also accepted.

## Rationale

The engine's only runtime dependency stays `typescript`, which ADR 0004 already requires. The schema is a
public artifact, so making it the source of truth is natural. The validator and YAML subset are small,
fully unit tested and have no parsing features that can be abused (no anchors, tags or merge keys).

## Consequences and tradeoffs

- TypeScript types in `ir/types.ts` and the JSON Schema are maintained side by side. Drift is caught because
  every report produced by every test is validated against the schema, and the type checker verifies the
  producer. A type added without a schema entry fails validation immediately.
- Users cannot use full YAML features in rules files. The error messages say what is unsupported.
- If the schema grows complex, switching to Zod (or generating the JSON Schema from Zod) remains possible
  because consumers only depend on the published schema.

## Security and operational implications

Fewer dependencies reduce supply-chain exposure. The YAML subset rejects anchors and tags, which removes
alias expansion attacks. Validation runs on every report before it is written.

## Validation plan

Done in Phase 1: schema round trip on all fixtures, mutation tests for the validator, YAML subset error tests.
Phase 2: contract test that the web app only reads fields defined in the schema.

## Conditions for reconsideration

Reconsider if the schema needs features the validator lacks (for example `oneOf`), if a second language needs
generated types from the schema, or if contributors regularly need richer YAML.
