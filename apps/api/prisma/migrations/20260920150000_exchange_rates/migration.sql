-- Phase C: exchange rate cache (provider + manual overrides)

CREATE TYPE "ExchangeRateSource" AS ENUM ('PROVIDER', 'MANUAL');

CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "provider" TEXT NOT NULL,
    "source" "ExchangeRateSource" NOT NULL DEFAULT 'PROVIDER',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exchange_rates_baseCurrency_quoteCurrency_effectiveAt_idx"
  ON "exchange_rates"("baseCurrency", "quoteCurrency", "effectiveAt");

CREATE INDEX "exchange_rates_fetchedAt_idx" ON "exchange_rates"("fetchedAt");

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
