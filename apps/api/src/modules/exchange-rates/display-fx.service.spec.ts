import { BadRequestException } from '@nestjs/common';
import { DisplayFxService } from './display-fx.service';
import type { CurrencyConversionService } from './currency-conversion.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUserDto } from '@fbm/shared';

function user(
  preferredDisplayCurrency: string | null = null,
): AuthUserDto {
  return {
    id: 'u1',
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    role: 'ADMIN',
    preferredDisplayCurrency,
  };
}

describe('DisplayFxService (Phase H)', () => {
  const prisma = {
    companySettings: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const currencyConversion = {
    convertForDisplay: jest.fn(),
  } as unknown as CurrencyConversionService;

  let service: DisplayFxService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue({
      defaultCurrency: 'EUR',
      defaultDisplayCurrency: 'EUR',
    });
    service = new DisplayFxService(prisma, currencyConversion);
  });

  describe('resolveCurrencies', () => {
    it('uses company default display when user has no preference', async () => {
      (prisma.companySettings.findFirst as jest.Mock).mockResolvedValue({
        defaultCurrency: 'EUR',
        defaultDisplayCurrency: 'AFN',
      });
      const result = await service.resolveCurrencies(user(null));
      expect(result).toEqual({
        baseCurrency: 'EUR',
        displayCurrency: 'AFN',
      });
    });

    it('prefers user preferredDisplayCurrency over company default', async () => {
      const result = await service.resolveCurrencies(user('USD'));
      expect(result.displayCurrency).toBe('USD');
      expect(result.baseCurrency).toBe('EUR');
    });

    it('query currency overrides user preference', async () => {
      const result = await service.resolveCurrencies(user('USD'), 'AFN');
      expect(result.displayCurrency).toBe('AFN');
    });

    it('rejects unsupported query currency', async () => {
      await expect(
        service.resolveCurrencies(user(null), 'GBP'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('convertMoneyFields', () => {
    it('identity when books === display', async () => {
      const result = await service.convertMoneyFields(
        ['100.0000', '50.0000'],
        'EUR',
        'EUR',
      );
      expect(result.amounts).toEqual(['100.0000', '50.0000']);
      expect(result.fx.status).toBe('identity');
      expect(result.fx.exchangeRate).toBe('1');
    });

    it('converts all amounts with one rate path', async () => {
      (currencyConversion.convertForDisplay as jest.Mock).mockImplementation(
        async (amount: string) => ({
          status: 'converted',
          originalAmount: amount,
          originalCurrency: 'EUR',
          convertedAmount: String(Number(amount) * 78.5),
          convertedCurrency: 'AFN',
          exchangeRate: '78.5',
          effectiveAt: '2026-09-21T00:00:00.000Z',
          fetchedAt: '2026-09-21T00:00:00.000Z',
          source: 'PROVIDER',
          provider: 'test',
          rateId: 'r1',
          isDisplayConversion: true,
        }),
      );

      const result = await service.convertMoneyFields(
        ['100.0000', '10.0000'],
        'EUR',
        'AFN',
      );
      expect(result.fx.status).toBe('converted');
      expect(result.fx.exchangeRate).toBe('78.5');
      expect(result.amounts[0]).toBe('7850');
      expect(result.amounts[1]).toBe('785');
    });

    it('fail-closed: keeps books amounts when any conversion unavailable', async () => {
      (currencyConversion.convertForDisplay as jest.Mock).mockResolvedValue({
        status: 'unavailable',
        originalAmount: '100.0000',
        originalCurrency: 'EUR',
        convertedAmount: null,
        convertedCurrency: 'AFN',
        exchangeRate: null,
        effectiveAt: null,
        fetchedAt: null,
        source: null,
        provider: null,
        rateId: null,
        isDisplayConversion: true,
      });

      const original = ['100.0000', '25.0000'];
      const result = await service.convertMoneyFields(
        original,
        'EUR',
        'AFN',
      );
      expect(result.fx.status).toBe('unavailable');
      expect(result.amounts).toEqual(original);
      expect(service.labeledCurrency(result.fx)).toBe('EUR');
    });
  });
});
