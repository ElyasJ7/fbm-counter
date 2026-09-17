# Expense payment integrity (H4)

## Decision: Option B — controlled state value

Expenses do **not** share the invoice `Payment` ledger. Introducing a full
`ExpensePayment` entity was deferred to keep this remediation minimal.

### Rules

- `CreateExpenseDto` / `UpdateExpenseDto` do **not** accept `paidAmount`.
- New expenses always start with `paidAmount = 0`.
- Payments are recorded only via `POST /api/expenses/:id/payments`
  (`finances:write`):
  - amount > 0
  - amount ≤ remaining balance
  - resulting paidAmount ≤ grossAmount
  - status derived via `resolveExpenseStatus`
- Generic PATCH cannot overwrite paid cash.

### Limitation

Expense paid amounts are denormalized on the expense row. They are not linked
to bank payment records. Cash-flow KPIs that use the `Payment` table will not
automatically include expense-only payments unless a later phase adds an
expense payment ledger (Option A).

### Reversal

Silent decreases via PATCH are blocked. A dedicated reversal endpoint was not
added in this batch; correct overstatement by recording carefully or a future
reversal workflow.
