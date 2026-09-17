# Finance metric definitions

Canonical terminology for dashboards, reports, ledgers, and PDFs.

| Term | Meaning | Typical source |
|------|---------|----------------|
| **Cash received** | Sum of customer invoice **payments** actually received (`paidAmount` on CUSTOMER invoices / INCOMING payments) | `customerRevenuePaid`, KPI `totalRevenue` (legacy field name) |
| **Customer invoiced (gross/net)** | Issued customer invoice totals (accrual-style) — **not** the default dashboard “revenue” KPI | Invoice `grossAmount`/`netAmount` |
| **Accounts receivable** | Outstanding CUSTOMER invoice balances | `outstandingByType('CUSTOMER')` |
| **Accounts payable** | Outstanding SUPPLIER invoice balances | `outstandingByType('SUPPLIER')` |
| **Actual costs** | Paid supplier invoice amounts + non-duplicate expense payments (invoice-wins policy) | `aggregateCosts` / `companyCostTotals` |
| **Cash paid / outflows** | OUTGOING payments | cash-flow charts |
| **Available cash** | All INCOMING − all OUTGOING payments | `cashFlowTotals.availableCash` |
| **Project profit (cash-based)** | Cash received − actual costs for the project/company | `grossProfit` / project profitability `profit` |

## Labeling rule

Do **not** label cash-received figures as generic “Revenue” / “Erlös” in UI or CSV.
Prefer **Cash received** / **Zahlungseingang**.

API field `totalRevenue` remains for compatibility but means **cash received**.
