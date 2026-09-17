# Date-only / timezone policy

## Distinction

| Kind | Examples | Representation |
|------|----------|----------------|
| Business date-only | invoice issue/due, payment date, project start/end, report from/to | `YYYY-MM-DD` |
| True timestamps | `createdAt`, `updatedAt`, `deletedAt`, audit | ISO DateTime UTC |

## Rules

1. API responses for business dates use **`YYYY-MM-DD`** (not full ISO midnight).
2. Persistence uses **UTC noon** for the calendar day (`dateOnlyToUtcDate`) to avoid DST edge cases.
3. Report `from` = UTC start of day; report `to` = UTC end of day (inclusive).
4. UI formatting uses `formatDateOnlyDe` / UTC calendar components — **never** `new Date('YYYY-MM-DD')` with local getters.

## Guarantee

`2026-09-17` remains `2026-09-17` in CET and CEST.

Helpers: `@fbm/financial-core` (`toDateOnlyString`, `dateOnlyToUtcDate`, `dateOnlyToUtcStartOfDay`, `dateOnlyToUtcEndOfDay`, `formatDateOnlyDe`).
