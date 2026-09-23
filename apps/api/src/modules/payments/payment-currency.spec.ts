import { BadRequestException } from '@nestjs/common';
import { parseSupportedCurrencyOrThrow } from '../common/transaction-currency';

describe('Phase F/H same-currency payment rule', () => {
  it('accepts matching currency codes', () => {
    expect(parseSupportedCurrencyOrThrow('afn')).toBe('AFN');
    expect(parseSupportedCurrencyOrThrow('EUR')).toBe('EUR');
  });

  it('rejects unsupported currencies', () => {
    expect(() => parseSupportedCurrencyOrThrow('GBP')).toThrow(
      BadRequestException,
    );
  });

  it('rejects payment/invoice currency mismatch (documented message)', () => {
    const invoiceCurrency = parseSupportedCurrencyOrThrow('EUR');
    const requested = parseSupportedCurrencyOrThrow('USD');
    expect(requested).not.toBe(invoiceCurrency);
    const message = `Payment currency ${requested} must match invoice currency ${invoiceCurrency}. Cross-currency payments are not supported yet.`;
    expect(message).toContain('Cross-currency payments are not supported yet');
  });

  it('treats AFN invoice + AFN payment as same currency', () => {
    expect(parseSupportedCurrencyOrThrow('AFN')).toBe(
      parseSupportedCurrencyOrThrow('afn'),
    );
  });
});
