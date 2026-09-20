import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dateOnlyToUtcDate,
  dateOnlyToUtcEndOfDay,
  dateOnlyToUtcStartOfDay,
  formatDateOnlyDe,
  toDateOnlyString,
} from './index';

describe('date-only safety', () => {
  it('keeps YYYY-MM-DD stable', () => {
    assert.equal(toDateOnlyString('2026-09-17'), '2026-09-17');
  });

  it('formats for en-US without shifting day', () => {
    assert.equal(formatDateOnlyDe('2026-09-17'), 'Sep 17, 2026');
  });

  it('handles month boundaries', () => {
    assert.equal(formatDateOnlyDe('2026-03-01'), 'Mar 1, 2026');
    assert.equal(formatDateOnlyDe('2026-02-28'), 'Feb 28, 2026');
  });

  it('handles CET/CEST DST boundary dates without shift', () => {
    // EU DST spring 2026-03-29, autumn 2026-10-25
    assert.equal(formatDateOnlyDe('2026-03-29'), 'Mar 29, 2026');
    assert.equal(formatDateOnlyDe('2026-10-25'), 'Oct 25, 2026');
  });

  it('stores UTC noon for persistence', () => {
    const d = dateOnlyToUtcDate('2026-09-17');
    assert.equal(d.toISOString(), '2026-09-17T12:00:00.000Z');
  });

  it('builds inclusive report range', () => {
    const from = dateOnlyToUtcStartOfDay('2026-01-01');
    const to = dateOnlyToUtcEndOfDay('2026-01-31');
    assert.equal(from.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(to.toISOString(), '2026-01-31T23:59:59.999Z');
    assert.ok(from < to);
  });

  it('extracts date-only from ISO timestamps via leading slice', () => {
    assert.equal(toDateOnlyString('2026-09-17T12:00:00.000Z'), '2026-09-17');
  });
});
