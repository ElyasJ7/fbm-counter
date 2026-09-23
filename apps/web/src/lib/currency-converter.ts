import { money } from '@fbm/financial-core';
import type { SupportedCurrency } from '@fbm/shared';

/** Normalize user amount input (en-US commas allowed) to a Decimal money string. */
export function parseConverterAmount(raw: string): string {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) {
    throw new Error('Amount is required');
  }
  return money(cleaned).toDecimalPlaces(4).toFixed(4);
}

export function swapCurrencies<T extends string>(from: T, to: T): { from: T; to: T } {
  return { from: to, to: from };
}

export const USD_QUICK_AMOUNTS = [
  '100',
  '500',
  '1000',
  '2500',
  '5000',
  '10000',
] as const;

export const AFN_QUICK_AMOUNTS = [
  '10000',
  '50000',
  '100000',
  '250000',
  '500000',
  '1000000',
] as const;

export function quickAmountsFor(from: SupportedCurrency): readonly string[] {
  if (from === 'USD') return USD_QUICK_AMOUNTS;
  if (from === 'AFN') return AFN_QUICK_AMOUNTS;
  // EUR: reuse USD-style magnitudes
  return USD_QUICK_AMOUNTS;
}

/** Decimal-safe unit × quantity for material cost (storage precision). */
export function materialSubtotal(unitPrice: string, quantity: string): string {
  return money(parseConverterAmount(unitPrice))
    .mul(money(parseConverterAmount(quantity)))
    .toDecimalPlaces(4)
    .toFixed(4);
}

export function formatRateLine(
  fromCurrency: string,
  toCurrency: string,
  rate: string | null,
): string | null {
  if (!rate) return null;
  return `1 ${fromCurrency} = ${rate} ${toCurrency}`;
}
