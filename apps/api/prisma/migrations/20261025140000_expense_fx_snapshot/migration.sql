-- Freeze USD↔AFN rate and dual amounts on each expense at booking time.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "usdToAfnRate" DECIMAL(19, 8);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(19, 4);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "amountAfn" DECIMAL(19, 4);
