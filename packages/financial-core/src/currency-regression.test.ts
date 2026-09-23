import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asDisplayMoneyString,
  convertMoney,
  invertRate,
  money,
} from './index.ts';

/**
 * Phase H — currency conversion regression.
 * Guards: Decimal math, identity path, display rounding, reverse pairs.
 */
describe('currency conversion regression (Phase H)', () => {
  it('never sums mixed currencies without an explicit rate', () => {
    // Documented invariant: callers must convert before aggregating.
    const eur = money('1000');
    const afn = money('78500');
    // Same-number sum would be nonsense across currencies — we only allow
    // summing after convertMoney to a common currency.
    const afnFromEur = convertMoney('1000', 'EUR', 'AFN', '78.5');
    const total = money(afnFromEur.convertedAmount).plus(afn);
    assert.equal(total.toFixed(4), '157000.0000');
  });

  it('EUR→AFN→EUR round-trips at storage precision for clean rates', () => {
    const toAfn = convertMoney('250.0000', 'EUR', 'AFN', '80');
    assert.equal(toAfn.convertedAmount, '20000.0000');
    const back = convertMoney(
      toAfn.convertedAmount,
      'AFN',
      'EUR',
      invertRate('80'),
    );
    assert.equal(back.convertedAmount, '250.0000');
  });

  it('display formatting does not mutate storage money', () => {
    const stored = money('1234.5678');
    assert.equal(stored.toFixed(4), '1234.5678');
    assert.equal(asDisplayMoneyString(stored), '1234.57');
    assert.equal(stored.toFixed(4), '1234.5678');
  });

  it('single-currency path stays identity (legacy EUR behavior)', () => {
    const result = convertMoney('42.1250', 'EUR', 'EUR', '999');
    assert.equal(result.convertedAmount, '42.1250');
    assert.equal(result.exchangeRate, '1');
    assert.equal(result.convertedCurrency, 'EUR');
  });
});
