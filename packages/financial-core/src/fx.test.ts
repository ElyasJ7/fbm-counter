import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asDisplayMoneyString,
  convertMoney,
  crossRateFromPivot,
  invertRate,
} from './fx';
import { money } from './money';

describe('FX conversion', () => {
  it('converts 100 EUR × 78.5 → 7850 AFN', () => {
    const result = convertMoney('100', 'EUR', 'AFN', '78.5');
    assert.equal(result.convertedAmount, '7850.0000');
    assert.equal(result.convertedCurrency, 'AFN');
  });

  it('reverse conversion 7850 AFN → 100 EUR', () => {
    const rate = invertRate('78.5');
    const result = convertMoney('7850', 'AFN', 'EUR', rate);
    assert.equal(result.convertedAmount, '100.0000');
  });

  it('builds EUR→AFN from USD pivot rates', () => {
    // 1 USD = 0.92 EUR, 1 USD = 72.22 AFN → 1 EUR = 72.22/0.92 AFN
    const rate = crossRateFromPivot(
      { USD: 1, EUR: '0.92', AFN: '72.22' },
      'EUR',
      'AFN',
    );
    assert.equal(rate.toDecimalPlaces(4).toFixed(4), '78.5000');
  });

  it('identity conversion when currencies match', () => {
    const result = convertMoney('42.5', 'AFN', 'AFN', '999');
    assert.equal(result.convertedAmount, '42.5000');
    assert.equal(result.exchangeRate, '1');
  });

  it('formats display money to 2 dp', () => {
    assert.equal(asDisplayMoneyString(money('7856.789')), '7856.79');
  });
});
