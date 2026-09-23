-- Phase F: transaction currency on invoices, expenses, payments
-- Legacy rows treated as EUR unless project/company currency says otherwise.

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

-- Backfill from linked project currency when present
UPDATE "expenses" e
SET "currency" = UPPER(p."currency")
FROM "projects" p
WHERE e."projectId" = p.id
  AND p."currency" IS NOT NULL
  AND LENGTH(TRIM(p."currency")) > 0;

UPDATE "invoices" i
SET "currency" = UPPER(p."currency")
FROM "projects" p
WHERE i."projectId" = p.id
  AND p."currency" IS NOT NULL
  AND LENGTH(TRIM(p."currency")) > 0;

-- Orphans: company books currency
UPDATE "expenses" e
SET "currency" = UPPER(cs."defaultCurrency")
FROM "company_settings" cs
WHERE e."projectId" IS NULL
  AND cs."defaultCurrency" IS NOT NULL
  AND LENGTH(TRIM(cs."defaultCurrency")) > 0;

UPDATE "invoices" i
SET "currency" = UPPER(cs."defaultCurrency")
FROM "company_settings" cs
WHERE i."projectId" IS NULL
  AND cs."defaultCurrency" IS NOT NULL
  AND LENGTH(TRIM(cs."defaultCurrency")) > 0;

-- Payments inherit invoice currency
UPDATE "payments" p
SET "currency" = UPPER(i."currency")
FROM "invoices" i
WHERE p."invoiceId" = i.id;
