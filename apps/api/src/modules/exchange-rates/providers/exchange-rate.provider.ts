import type { Decimal } from '@fbm/financial-core';

export type FetchedRateQuote = {
  baseCurrency: string;
  quoteCurrency: string;
  /** Units of quote per 1 base. */
  rate: Decimal;
  effectiveAt: Date;
};

export type FetchLatestResult = {
  provider: string;
  fetchedAt: Date;
  /** Pivot currency used by the upstream API (often USD). */
  pivotCurrency: string;
  /** Units of each currency per 1 pivot. */
  pivotRates: Record<string, Decimal>;
  quotes: FetchedRateQuote[];
};

/**
 * Abstraction over external FX APIs.
 * Business logic must not depend on a concrete HTTP vendor.
 */
export interface ExchangeRateProvider {
  readonly name: string;
  isConfigured(): boolean;
  fetchLatest(currencies: readonly string[]): Promise<FetchLatestResult>;
}

export const EXCHANGE_RATE_PROVIDER = Symbol('EXCHANGE_RATE_PROVIDER');
