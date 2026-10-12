-- EUR is no longer a supported currency. Remap books/display defaults and
-- open transaction rows that still use EUR to AFN.
UPDATE "company_settings"
SET
  "defaultCurrency" = 'AFN',
  "defaultDisplayCurrency" = 'AFN'
WHERE "defaultCurrency" = 'EUR' OR "defaultDisplayCurrency" = 'EUR';

UPDATE "users"
SET "preferredDisplayCurrency" = 'AFN'
WHERE "preferredDisplayCurrency" = 'EUR';

UPDATE "projects" SET "currency" = 'AFN' WHERE "currency" = 'EUR';
UPDATE "expenses" SET "currency" = 'AFN' WHERE "currency" = 'EUR';
UPDATE "invoices" SET "currency" = 'AFN' WHERE "currency" = 'EUR';
UPDATE "payments" SET "currency" = 'AFN' WHERE "currency" = 'EUR';

-- Drop cached EUR exchange-rate pairs (no longer offered).
DELETE FROM "exchange_rates"
WHERE "baseCurrency" = 'EUR' OR "quoteCurrency" = 'EUR';
