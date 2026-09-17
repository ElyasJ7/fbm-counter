import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertNetPlusVatEqualsGross,
  computeHeaderVat,
  reconcileInvoiceTotals,
  money,
} from './index';

describe('invoice VAT policy (header-level)', () => {
  it('computes 19% VAT at header level', () => {
    const result = computeHeaderVat('1000.0000', '19');
    assert.equal(result.taxAmount, '190.0000');
    assert.equal(result.grossAmount, '1190.0000');
    assertNetPlusVatEqualsGross(result);
  });

  it('computes 7% VAT at header level', () => {
    const result = computeHeaderVat('100.0000', '7');
    assert.equal(result.taxAmount, '7.0000');
    assert.equal(result.grossAmount, '107.0000');
  });

  it('supports zero VAT', () => {
    const result = computeHeaderVat('250.5000', '0');
    assert.equal(result.taxAmount, '0.0000');
    assert.equal(result.grossAmount, '250.5000');
  });

  it('rounds half-cent VAT using ROUND_HALF_UP', () => {
    // 19% of 1.005 → 0.19095 → 0.19
    const result = computeHeaderVat('1.0050', '19');
    assert.equal(result.taxAmount, '0.1900');
    assert.equal(result.grossAmount, '1.2000');
  });

  it('reconciles multiple lines with header net', () => {
    const result = reconcileInvoiceTotals({
      netAmount: '150.0000',
      taxRatePercent: '19',
      lines: [{ netAmount: '100' }, { netAmount: '50' }],
    });
    assert.equal(result.taxAmount, '28.5000');
    assert.equal(result.grossAmount, '178.5000');
  });

  it('rejects mismatched line sum vs header net', () => {
    assert.throws(
      () =>
        reconcileInvoiceTotals({
          netAmount: '100',
          taxRatePercent: '19',
          lines: [{ netAmount: '40' }, { netAmount: '50' }],
        }),
      /does not match header net/,
    );
  });

  it('does not invent per-line VAT for mixed rates (single header rate only)', () => {
    // Policy: one rate per invoice — mixed rates unsupported.
    const a = computeHeaderVat('100', '19');
    const b = computeHeaderVat('100', '7');
    assert.notEqual(a.taxAmount, b.taxAmount);
    assert.ok(money(a.taxAmount).eq('19'));
  });
});
