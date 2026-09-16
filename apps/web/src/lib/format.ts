import { formatMoneyDe } from '@fbm/financial-core';

export function formatCurrency(value: string | number, currency = 'EUR') {
  return formatMoneyDe(value, currency);
}

export function formatDateDe(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE').format(date);
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}
