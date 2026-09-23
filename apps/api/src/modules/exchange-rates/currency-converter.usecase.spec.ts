import {
  asDisplayMoneyString,
  convertMoney,
  convertWithRate,
  invertRate,
  money,
} from '@fbm/financial-core';

/**
 * Converter use-case regressions — math stays in financial-core / API service.
 */
describe('Currency converter use cases (reuse FX core)', () => {
  it('USD → AFN', () => {
    const result = convertMoney('1000', 'USD', 'AFN', '68.5');
    expect(result.convertedAmount).toBe('68500.0000');
  });

  it('AFN → USD via inverted rate', () => {
    const rate = invertRate('68.5');
    const result = convertMoney('68500', 'AFN', 'USD', rate);
    expect(result.convertedAmount).toBe('1000.0000');
  });

  it('EUR → AFN', () => {
    const result = convertMoney('100', 'EUR', 'AFN', '78.5');
    expect(result.convertedAmount).toBe('7850.0000');
  });

  it('USD → EUR', () => {
    const result = convertMoney('100', 'USD', 'EUR', '0.92');
    expect(result.convertedAmount).toBe('92.0000');
  });

  it('same currency is identity', () => {
    const result = convertMoney('800', 'USD', 'USD', '999');
    expect(result.convertedAmount).toBe('800.0000');
    expect(result.exchangeRate).toBe('1');
  });

  it('salary conversion uses Decimal path', () => {
    const result = convertMoney('800', 'USD', 'AFN', '68.5');
    expect(asDisplayMoneyString(money(result.convertedAmount))).toBe(
      '54800.00',
    );
  });

  it('material quantity × unit then convert', () => {
    const subtotal = money('25').mul(money('200'));
    expect(subtotal.toFixed(4)).toBe('5000.0000');
    const converted = convertWithRate(subtotal, '68.5');
    expect(asDisplayMoneyString(converted)).toBe('342500.00');
  });

  it('never uses JS Number for converter multiply', () => {
    const a = money('0.1');
    const b = money('0.2');
    expect(a.mul(b).toFixed(4)).toBe('0.0200');
    expect(Number(0.1) * Number(0.2)).not.toBe(0.02);
  });
});
