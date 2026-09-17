import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Parse a monetary string/number into Decimal. Never use raw JS floats for money. */
export function money(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function asMoneyString(value: Decimal): string {
  return value.toDecimalPlaces(4).toFixed(4);
}
