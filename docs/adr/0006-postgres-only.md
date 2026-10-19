# ADR 0006: Postgres for data and queue

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated in Phase 2 P2-03 and P2-05

## Context

Need jobs, report storage, history, and later accounts.

## Requirements and constraints

No message broker, graph database, or search cluster without measured need. Free tier friendly.

## Alternatives considered

A. Postgres with pg-boss and JSONB reports.
B. Redis plus BullMQ plus object storage.
C. SQLite on the worker.

## Decision

Use Postgres (managed free tier in production, Docker locally), pg-boss for jobs, JSONB for reports, Drizzle for schema and migrations.

## Rationale

One dependency covers queue, storage, and history. Reports are typically small enough for JSONB.

## Consequences and tradeoffs

Free tiers have size and connection limits and may pause. Very large reports may need object storage later.

## Security and operational implications

Parameterized queries only. Connection strings in environment secrets. Row retention job.

## Validation plan

Measure report sizes on 5 public repositories in Phase 1 and query latency in Phase 2.

## Conditions for reconsideration

If reports regularly exceed a few MB or queue throughput needs exceed Postgres capacity.
