# Cost accounting policy

Canonical cost aggregation lives in `@fbm/financial-core` (`aggregateCosts` /
`aggregateSupplierSpend`). Dashboard, reports, project finance, budgets, and
supplier totals must reuse these helpers — do not sum expenses and supplier
invoices independently.

## Double-counting problem (historical)

The same payable could appear as:

1. a `SUPPLIER` invoice (`paidAmount` / open remaining), and
2. an `Expense` with the same `invoiceNumber`

Older KPI paths added both, inflating actual cost, profit, and supplier spend.

## Rule (invoice wins)

- **Payable partner cost source of truth:** non-draft, non-cancelled `SUPPLIER` invoices.
- **Expenses:** operational costs. If `expense.invoiceNumber` matches a supplier
  invoice number (trim + case-insensitive), the expense is treated as a
  duplicate and **excluded** from aggregations.
- Supplier invoice category bucket for budget sync: `OTHER` (invoices have no
  budget category field).

## KPI definitions

| Metric | Definition |
| --- | --- |
| Actual Project Cost | Σ supplier `paidAmount` + Σ non-duplicate expense `paidAmount` |
| Company Expenses | Same rule, company-wide |
| Accounts Payable | Σ open supplier invoice remaining only |
| Supplier Spend | Supplier invoices for that supplier + non-duplicate expenses |
| Subcontractor Spend | Subcontractor-linked supplier invoices only (unchanged) |
| Project Profit | Customer revenue received − actual project cost |
| Committed Cost | Open supplier remaining + open non-duplicate expense remaining |

## Mutation sync

Budget line `actualAmount` / `committedAmount` are derived via the same policy
when budget sync runs (see P2-04).
