import { formatMoneyDe, formatDateOnlyDe, toDateOnlyString } from '@fbm/financial-core';
import { DEFAULT_CURRENCY } from '@fbm/shared';

export function formatCurrency(
  value: string | number,
  currency: string = DEFAULT_CURRENCY,
) {
  return formatMoneyDe(value, currency);
}

/** Form field label with ISO currency code, e.g. Amount (EUR). */
export function amountFieldLabel(currency?: string | null) {
  const code =
    (currency ?? DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY;
  return `Amount (${code})`;
}

/** Form field label with ISO currency code, e.g. Net Amount (EUR). */
export function netAmountFieldLabel(currency?: string | null) {
  const code =
    (currency ?? DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY;
  return `Net Amount (${code})`;
}

/** Business calendar dates — no timezone day-shift. */
export function formatDateDe(value: string | null | undefined) {
  return formatDateOnlyDe(value);
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  try {
    return toDateOnlyString(value);
  } catch {
    return value.slice(0, 10);
  }
}
