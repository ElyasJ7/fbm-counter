import { formatMoneyDe, formatDateOnlyDe, toDateOnlyString } from '@fbm/financial-core';

export function formatCurrency(value: string | number, currency = 'EUR') {
  return formatMoneyDe(value, currency);
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
