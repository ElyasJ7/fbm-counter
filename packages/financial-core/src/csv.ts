/**
 * CSV export cell escaping.
 *
 * - Neutralize spreadsheet formula injection for text cells.
 * - Preserve ordinary numbers (including negatives like `-12.5`) as numeric text
 *   when the whole cell is a plain number.
 * - Quote fields that contain separators or special characters.
 * - Default separator is comma (international / en-US).
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function isPlainNumericCell(value: string): boolean {
  return /^-?\d+([.,]\d+)?$/.test(value.trim());
}

/** Prefix dangerous leading characters so Excel/LibreOffice treat cell as text. */
export function neutralizeCsvFormula(value: string): string {
  if (!value) return value;
  if (isPlainNumericCell(value)) return value.trim();
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function csvEscapeCell(
  value: string | number | null | undefined,
  separator = ',',
): string {
  const raw = value == null ? '' : String(value);
  const safe = neutralizeCsvFormula(raw);
  if (
    safe.includes(separator) ||
    /["\n\r]/.test(safe) ||
    safe.startsWith("'")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toCsvDocument(
  rows: Array<Array<string | number | null | undefined>>,
  separator = ',',
): string {
  const bom = '\uFEFF';
  const body = rows
    .map((row) => row.map((cell) => csvEscapeCell(cell, separator)).join(separator))
    .join('\r\n');
  return `${bom}${body}\r\n`;
}
