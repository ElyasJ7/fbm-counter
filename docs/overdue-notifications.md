# Overdue notification lifecycle (H10)

## Dedupe key

`invoice.overdue:<invoiceId>` stored on `notifications.dedupeKey`

Unique constraint: `(userId, dedupeKey)`

## Rules

1. While an **unread** notification with that key exists → no duplicate insert.
2. Daily cron (`OverdueInvoicesJob`, 06:00) marks overdue invoices and notifies
   with the same key (idempotent).
3. When the invoice leaves overdue (payment / cured):
   `clearInvoiceOverdueDedupe` marks unread rows read and **clears** `dedupeKey`.
4. If the invoice becomes overdue again later, a new notification may be created.

## Multi-instance

Job uses `pg_try_advisory_lock(872314059)` so only one replica runs the sweep.
