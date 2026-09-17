# Invoice VAT policy (FBM Counter)

This document describes the **application** VAT calculation rules used by FBM Counter.

It is **not** tax-advice and does **not** claim German tax-law compliance.

## Model

- Each invoice has a **single header `taxRate`** (percent).
- VAT is calculated at **invoice-total (header) level**, not per line.
- Line items store **net amounts only** (quantity × unit price). They do not store independent VAT.
- Mixed VAT rates on one invoice are **not supported**.

## Rounding

Using Decimal.js with `ROUND_HALF_UP`:

1. `netAmount` stored at 4 decimal places
2. `taxAmount = round(netAmount × taxRate / 100, 2)` then stored as 4 dp string
3. `grossAmount = round(netAmount + taxAmount, 2)` then stored as 4 dp string

Therefore:

- `sum(line.netAmount) == header.netAmount` (when lines exist)
- `header.netAmount + header.taxAmount == header.grossAmount` (at 2 dp money precision)

Canonical helpers live in `@fbm/financial-core`:

- `computeHeaderVat`
- `reconcileInvoiceTotals`

## PDF / reports

PDF and report totals must use the same header net/tax/gross values persisted in the database.
