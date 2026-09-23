-- Phase B: company base/display currency + timezone
-- Legacy rows: display currency mirrors base currency; timezone UTC.

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "defaultDisplayCurrency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';

UPDATE "company_settings"
SET "defaultDisplayCurrency" = "defaultCurrency"
WHERE "defaultDisplayCurrency" IS DISTINCT FROM "defaultCurrency";
