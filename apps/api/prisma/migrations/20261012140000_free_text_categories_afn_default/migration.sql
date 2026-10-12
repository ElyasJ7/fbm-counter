-- Free-text budget/expense categories + AFN default currency for expenses.
ALTER TABLE "budget_lines" ALTER COLUMN "category" TYPE TEXT USING ("category"::text);
ALTER TABLE "expenses" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "expenses" ALTER COLUMN "category" TYPE TEXT USING ("category"::text);
ALTER TABLE "expenses" ALTER COLUMN "category" SET DEFAULT 'OTHER';

DROP TYPE IF EXISTS "BudgetCategory";

ALTER TABLE "expenses" ALTER COLUMN "currency" SET DEFAULT 'AFN';

ALTER TABLE "company_settings" ALTER COLUMN "defaultCurrency" SET DEFAULT 'AFN';
ALTER TABLE "company_settings" ALTER COLUMN "defaultDisplayCurrency" SET DEFAULT 'AFN';
ALTER TABLE "projects" ALTER COLUMN "currency" SET DEFAULT 'AFN';
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'AFN';
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'AFN';
