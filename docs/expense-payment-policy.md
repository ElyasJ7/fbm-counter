# Payment policy (expenses & invoices)

## Decision: always fully paid — no Payments page

Expenses and invoices do **not** use a payment ledger. When recorded they are
always saved as **fully paid** (`paidAmount = grossAmount`, `status = PAID`).

### Rules

- There is no Payments UI; `/payments` redirects to invoices.
- `POST /api/payments` returns **410 Gone**.
- Expense create/update sets `paidAmount` to gross (unless `CANCELLED`).
- Invoice create/update sets `paidAmount` to gross (unless `CANCELLED`).

### Expense access

- **Delete:** Admin only (`expenses:delete`).
- **Create / edit:** Admin and Project Manager unrestricted; Accounting only
  when currency is AFN and gross ≤ 5,000 AFN.
