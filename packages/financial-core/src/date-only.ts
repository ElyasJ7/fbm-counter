/**
 * Business calendar dates (date-only) vs timestamps.
 *
 * Date-only values are stored/transferred as `YYYY-MM-DD` strings.
 * They must never be interpreted via `new Date('YYYY-MM-DD')` in a local
 * timezone (that becomes UTC midnight and can shift the calendar day in CET/CEST).
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DateOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateOnlyError';
  }
}

export function isDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Normalize API/DB ISO or date-only input to `YYYY-MM-DD`. */
export function toDateOnlyString(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new DateOnlyError('Invalid Date');
    }
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const trimmed = value.trim();
  if (isDateOnlyString(trimmed)) return trimmed;
  // ISO timestamp: take the calendar date from the UTC components of the instant
  // only when the original string was a full ISO datetime. Prefer leading YYYY-MM-DD.
  const leading = trimmed.slice(0, 10);
  if (isDateOnlyString(leading)) return leading;
  throw new DateOnlyError(`Expected YYYY-MM-DD, got: ${value}`);
}

/**
 * Persist a business date as a Date at UTC noon for that calendar day.
 * Noon avoids DST edge cases when some layers still use local getters.
 */
export function dateOnlyToUtcDate(value: string): Date {
  const day = toDateOnlyString(value);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Inclusive end-of-day UTC instant for a business `to` date. */
export function dateOnlyToUtcEndOfDay(value: string): Date {
  const day = toDateOnlyString(value);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

/** Inclusive start-of-day UTC instant for a business `from` date. */
export function dateOnlyToUtcStartOfDay(value: string): Date {
  const day = toDateOnlyString(value);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** Format for UI (de-DE) without timezone shift. */
export function formatDateOnlyDe(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  try {
    const day = toDateOnlyString(value);
    const [y, m, d] = day.split('-').map(Number);
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  } catch {
    return '—';
  }
}
