import { Decimal, money } from './money';

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyParseError';
  }
}

/**
 * Parse user-facing monetary input into a Decimal.
 *
 * Accepted:
 * - `1234.56` (plain / API style)
 * - `1.234,56` / `1234,56` / `0,99` (comma decimal)
 * - optional leading `+` / `-`
 * - optional trailing/leading spaces
 * - optional € / EUR suffix/prefix
 *
 * Rejected (no silent reinterpretation):
 * - empty / non-numeric
 * - mixed ambiguous separators (e.g. `1,234.56` with both grouping styles)
 * - multiple decimal separators
 */
export function parseMoneyDe(raw: string): Decimal {
  if (typeof raw !== 'string') {
    throw new MoneyParseError('Amount must be a string');
  }
  let value = raw.trim();
  if (!value) {
    throw new MoneyParseError('Amount is empty');
  }

  value = value.replace(/\s/g, '');
  value = value.replace(/€/g, '');
  value = value.replace(/EUR/gi, '');
  value = value.trim();

  let negative = false;
  if (value.startsWith('+')) {
    value = value.slice(1);
  } else if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  }

  if (!value || !/^[\d.,]+$/.test(value)) {
    throw new MoneyParseError(`Invalid amount: ${raw}`);
  }

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    // German: dots = thousands, comma = decimal → last separator must be comma
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = value.replace(/\./g, '').replace(',', '.');
    } else {
      throw new MoneyParseError(
        `Ambiguous amount (use 1234.56 or 1.234,56): ${raw}`,
      );
    }
  } else if (hasComma) {
    // German decimal comma (and optional thousand dots already absent)
    const parts = value.split(',');
    if (parts.length !== 2) {
      throw new MoneyParseError(`Invalid amount: ${raw}`);
    }
    if (!/^\d+$/.test(parts[0]) || !/^\d{1,4}$/.test(parts[1])) {
      throw new MoneyParseError(`Invalid amount: ${raw}`);
    }
    normalized = `${parts[0]}.${parts[1]}`;
  } else if (hasDot) {
    const parts = value.split('.');
    if (!parts.every((p) => /^\d+$/.test(p))) {
      throw new MoneyParseError(`Invalid amount: ${raw}`);
    }
    // German thousand grouping: 1.234 or 1.234.567
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      normalized = parts.join('');
    } else if (parts.length === 2 && parts[1].length <= 4) {
      // Plain decimal 1234.56
      normalized = value;
    } else {
      throw new MoneyParseError(`Invalid amount: ${raw}`);
    }
  } else {
    normalized = value;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new MoneyParseError(`Invalid amount: ${raw}`);
  }

  try {
    const amount = money(normalized);
    return negative ? amount.neg() : amount;
  } catch {
    throw new MoneyParseError(`Invalid amount: ${raw}`);
  }
}

/** Parse and return fixed 4 dp string for API/storage. */
export function parseMoneyDeToFixed(raw: string, dp = 4): string {
  return parseMoneyDe(raw).toDecimalPlaces(dp).toFixed(dp);
}
