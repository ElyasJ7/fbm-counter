import { convertMoney, crossRateFromPivot, money } from '@fbm/financial-core';

describe('exchange rate conversion helpers (Phase C)', () => {
  it('100 EUR at 78.5 → 7850 AFN', () => {
    const result = convertMoney('100', 'EUR', 'AFN', '78.5');
    expect(result.convertedAmount).toBe('7850.0000');
  });

  it('builds pairs from USD pivot without inventing rates', () => {
    const rate = crossRateFromPivot(
      { USD: money(1), EUR: money('0.92'), AFN: money('72.22') },
      'EUR',
      'AFN',
    );
    expect(rate.toDecimalPlaces(4).toFixed(4)).toBe('78.5000');
  });
});
