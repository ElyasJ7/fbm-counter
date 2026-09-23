import { money, asMoneyString, Decimal, type Decimal as DecimalType } from './money';

/**
 * Given rates quoted as "units of currency per 1 pivot" (e.g. Open Exchange Rates USD base),
 * compute how many units of `quote` equal 1 unit of `base`.
 */
export function crossRateFromPivot(
  pivotRates: Record<string, string | number | DecimalType>,
  baseCurrency: string,
  quoteCurrency: string,
): DecimalType {
  const base = baseCurrency.trim().toUpperCase();
  const quote = quoteCurrency.trim().toUpperCase();
  if (base === quote) return money(1);

  const basePerPivot = pivotRates[base];
  const quotePerPivot = pivotRates[quote];
  if (basePerPivot == null || quotePerPivot == null) {
    throw new Error(
      `Missing pivot rate for ${base}/${quote} (need both currencies vs pivot)`,
    );
  }

  const baseRate = money(basePerPivot);
  const quoteRate = money(quotePerPivot);
  if (baseRate.isZero()) {
    throw new Error(`Invalid zero pivot rate for ${base}`);
  }
  return quoteRate.div(baseRate);
}

/** Convert amount using rate where 1 fromCurrency = rate toCurrency. */
export function convertWithRate(
  amount: string | number | DecimalType,
  rate: string | number | DecimalType,
): DecimalType {
  return money(amount).mul(money(rate));
}

export function invertRate(rate: string | number | DecimalType): DecimalType {
  const r = money(rate);
  if (r.isZero()) throw new Error('Cannot invert a zero exchange rate');
  return money(1).div(r);
}

export type ConversionResult = {
  originalAmount: string;
  originalCurrency: string;
  convertedAmount: string;
  convertedCurrency: string;
  exchangeRate: string;
};

export function convertMoney(
  amount: string | number | DecimalType,
  fromCurrency: string,
  toCurrency: string,
  rate: string | number | DecimalType,
): ConversionResult {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  const original = money(amount);
  if (from === to) {
    return {
      originalAmount: asMoneyString(original),
      originalCurrency: from,
      convertedAmount: asMoneyString(original),
      convertedCurrency: to,
      exchangeRate: '1',
    };
  }
  const r = money(rate);
  const converted = convertWithRate(original, r);
  return {
    originalAmount: asMoneyString(original),
    originalCurrency: from,
    convertedAmount: asMoneyString(converted),
    convertedCurrency: to,
    exchangeRate: r.toDecimalPlaces(8).toFixed(),
  };
}

/** Round converted display amounts to 2 decimal places (presentation only). */
export function asDisplayMoneyString(value: DecimalType): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
