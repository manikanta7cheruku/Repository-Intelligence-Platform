# ADR 0009: Next.js on Vercel with a token-driven custom design system

- Status: Accepted
- Date: 2026-10-19
- Owner approval: Approved 2026-10-19
- Technical validation: Validated in Phase 2 P2-02

## Context

Professional, dense, accessible UI is a primary goal and must avoid generic template looks.

## Requirements and constraints

Vercel deployment, accessibility, solo maintainability.

## Alternatives considered

A. Next.js with a prebuilt component kit styled as shipped.
B. Next.js with Radix primitives and our own tokens and components.
C. Separate SPA.

## Decision

Use Next.js App Router with TypeScript, Radix primitives for accessible behavior, CSS variables from docs/ux/design-tokens.md, and our own component library in the app. No UI kit defaults.

## Rationale

Primitives give accessibility correctness. Our tokens give a distinct professional identity.

## Consequences and tradeoffs

More design work up front. The design docs reduce rework.

## Security and operational implications

Strict Content Security Policy. Reports rendered as data, never as raw HTML. Exported HTML escapes everything.

## Validation plan

Axe, keyboard tests, Lighthouse, visual review against wireframes.

## Conditions for reconsideration

If Next.js or Vercel terms or limits no longer fit.
