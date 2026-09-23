import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatRateLine,
  materialSubtotal,
  parseConverterAmount,
  quickAmountsFor,
  swapCurrencies,
} from './currency-converter.ts';

describe('currency converter helpers', () => {
  it('parses en-US amounts with commas', () => {
    assert.equal(parseConverterAmount('1,000.00'), '1000.0000');
    assert.equal(parseConverterAmount('1000'), '1000.0000');
  });

  it('swaps from/to currencies', () => {
    assert.deepEqual(swapCurrencies('USD', 'AFN'), {
      from: 'AFN',
      to: 'USD',
    });
  });

  it('returns USD/AFN quick amount presets', () => {
    assert.ok(quickAmountsFor('USD').includes('1000'));
    assert.ok(quickAmountsFor('AFN').includes('100000'));
  });

  it('computes material subtotal with Decimal precision', () => {
    assert.equal(materialSubtotal('25.00', '200'), '5000.0000');
    assert.equal(materialSubtotal('0.10', '3'), '0.3000');
  });

  it('formats rate line when rate present', () => {
    assert.equal(formatRateLine('USD', 'AFN', '68.5'), '1 USD = 68.5 AFN');
    assert.equal(formatRateLine('USD', 'AFN', null), null);
  });

  it('rejects empty amount', () => {
    assert.throws(() => parseConverterAmount(''), /Amount is required/);
  });
});
