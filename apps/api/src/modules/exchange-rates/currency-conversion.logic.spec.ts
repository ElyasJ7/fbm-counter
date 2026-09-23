import {
  asDisplayMoneyString,
  convertMoney,
  convertWithRate,
  invertRate,
  money,
} from '@fbm/financial-core';

describe('CurrencyConversionService math (Phase D)', () => {
  it('converts 100 EUR × 78.5 → 7850 AFN (storage precision)', () => {
    const result = convertMoney('100', 'EUR', 'AFN', '78.5');
    expect(result.convertedAmount).toBe('7850.0000');
  });

  it('display rounding uses 2 decimal places', () => {
    const converted = convertWithRate('100.00', '78.56789');
    expect(asDisplayMoneyString(converted)).toBe('7856.79');
  });

  it('reverse AFN → EUR via inverted rate', () => {
    const rate = invertRate('78.5');
    const result = convertMoney('7850', 'AFN', 'EUR', rate);
    expect(result.convertedAmount).toBe('100.0000');
  });

  it('never uses JS Number for money multiply', () => {
    const a = money('0.1');
    const b = money('0.2');
    expect(a.mul(b).toFixed(4)).toBe('0.0200');
    // Contrast: Number(0.1)*Number(0.2) is not 0.02 exactly
    expect(Number(0.1) * Number(0.2)).not.toBe(0.02);
  });
});
