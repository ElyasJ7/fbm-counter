import { parseMoneyDeToFixed, MoneyParseError } from '@fbm/financial-core';

/** Parse a form money field; returns null when empty; throws MoneyParseError when invalid. */
export function parseFormMoney(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseMoneyDeToFixed(trimmed);
}

export { MoneyParseError };
