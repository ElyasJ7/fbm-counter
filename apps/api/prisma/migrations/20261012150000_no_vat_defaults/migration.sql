-- Afghanistan: no VAT — default rates to 0.
ALTER TABLE "company_settings" ALTER COLUMN "defaultVatRate" SET DEFAULT 0;
UPDATE "company_settings" SET "defaultVatRate" = 0;

ALTER TABLE "expenses" ALTER COLUMN "taxRate" SET DEFAULT 0;
ALTER TABLE "invoices" ALTER COLUMN "taxRate" SET DEFAULT 0;
