-- Phase E: per-user preferred display currency

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preferredDisplayCurrency" TEXT;
