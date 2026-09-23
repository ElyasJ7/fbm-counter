import { BadRequestException, Injectable } from '@nestjs/common';
import {
  assertSupportedCurrency,
  DEFAULT_CURRENCY,
  DEFAULT_DISPLAY_CURRENCY,
  type AuthUserDto,
  type DisplayFxMetaDto,
  type MoneyConversionResultDto,
} from '@fbm/shared';
import { CurrencyConversionService } from './currency-conversion.service';
import { PrismaService } from '../prisma/prisma.service';

export type { DisplayFxMetaDto };

@Injectable()
export class DisplayFxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConversion: CurrencyConversionService,
  ) {}

  async resolveCurrencies(
    user: AuthUserDto,
    queryCurrency?: string,
  ): Promise<{ baseCurrency: string; displayCurrency: string }> {
    const settings = await this.prisma.companySettings.findFirst({
      select: { defaultCurrency: true, defaultDisplayCurrency: true },
    });
    const baseCurrency = settings?.defaultCurrency ?? DEFAULT_CURRENCY;
    const companyDisplay =
      settings?.defaultDisplayCurrency ??
      settings?.defaultCurrency ??
      DEFAULT_DISPLAY_CURRENCY;

    let displayCurrency =
      user.preferredDisplayCurrency?.trim() || companyDisplay;

    if (queryCurrency?.trim()) {
      try {
        displayCurrency = assertSupportedCurrency(queryCurrency);
      } catch {
        throw new BadRequestException(
          `Unsupported currency "${queryCurrency}". Allowed: AFN, EUR, USD`,
        );
      }
    } else {
      try {
        displayCurrency = assertSupportedCurrency(displayCurrency);
      } catch {
        displayCurrency = DEFAULT_DISPLAY_CURRENCY;
      }
    }

    return { baseCurrency, displayCurrency };
  }

  private convertAmount(
    amount: string,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<MoneyConversionResultDto> {
    return this.currencyConversion.convertForDisplay(
      amount,
      fromCurrency,
      toCurrency,
    );
  }

  /**
   * Convert book amounts to display currency.
   * If any conversion is unavailable, keep books amounts and report unavailable.
   */
  async convertMoneyFields(
    amounts: string[],
    baseCurrency: string,
    displayCurrency: string,
  ): Promise<{ amounts: string[]; fx: DisplayFxMetaDto }> {
    if (baseCurrency === displayCurrency) {
      return {
        amounts,
        fx: {
          status: 'identity',
          baseCurrency,
          displayCurrency,
          exchangeRate: '1',
          effectiveAt: null,
          fetchedAt: null,
          provider: 'identity',
        },
      };
    }

    if (amounts.length === 0) {
      const probe = await this.convertAmount('1', baseCurrency, displayCurrency);
      return {
        amounts,
        fx: {
          status: probe.status,
          baseCurrency,
          displayCurrency,
          exchangeRate: probe.exchangeRate,
          effectiveAt: probe.effectiveAt,
          fetchedAt: probe.fetchedAt,
          provider: probe.provider,
        },
      };
    }

    const converted: string[] = [];
    let meta: DisplayFxMetaDto | null = null;

    for (const amount of amounts) {
      const result = await this.convertAmount(
        amount,
        baseCurrency,
        displayCurrency,
      );
      if (result.status === 'unavailable' || result.convertedAmount == null) {
        return {
          amounts,
          fx: {
            status: 'unavailable',
            baseCurrency,
            displayCurrency,
            exchangeRate: null,
            effectiveAt: null,
            fetchedAt: null,
            provider: null,
          },
        };
      }
      converted.push(result.convertedAmount);
      if (!meta) {
        meta = {
          status: result.status,
          baseCurrency,
          displayCurrency,
          exchangeRate: result.exchangeRate,
          effectiveAt: result.effectiveAt,
          fetchedAt: result.fetchedAt,
          provider: result.provider,
        };
      }
    }

    return {
      amounts: converted,
      fx: meta!,
    };
  }

  /** Amounts labeled currency when FX fails: keep books code. */
  labeledCurrency(fx: DisplayFxMetaDto): string {
    return fx.status === 'unavailable' ? fx.baseCurrency : fx.displayCurrency;
  }
}
