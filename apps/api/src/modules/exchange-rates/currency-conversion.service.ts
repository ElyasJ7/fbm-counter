import { BadRequestException, Injectable } from '@nestjs/common';
import {
  asDisplayMoneyString,
  asMoneyString,
  convertWithRate,
  money,
} from '@fbm/financial-core';
import {
  assertSupportedCurrency,
  type MoneyConversionResultDto,
} from '@fbm/shared';
import { ExchangeRatesService } from './exchange-rates.service';

export type ConvertMoneyInput = {
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  /**
   * When set, use rate effective at/before this instant (accounting / historical).
   * When omitted, use latest cached rate (display conversion).
   */
  asOf?: string | Date | null;
  /** When true (default for display), round converted amount to 2 dp for presentation. */
  forDisplay?: boolean;
};

/**
 * Centralized FX conversion. Controllers and finance services must use this —
 * do not multiply by rates in React or ad-hoc service code.
 */
@Injectable()
export class CurrencyConversionService {
  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  /**
   * Display conversion: latest cached rate (or inverted reverse pair).
   * Never invents a rate; returns status unavailable when missing.
   */
  async convertForDisplay(
    amount: string,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<MoneyConversionResultDto> {
    return this.convert({
      amount,
      fromCurrency,
      toCurrency,
      forDisplay: true,
    });
  }

  /**
   * Accounting / historical conversion: rate effective at `asOf`.
   * Pass an explicit snapshot rate via convertWithExplicitRate when the
   * transaction already stored its FX snapshot.
   */
  async convertAsOf(
    amount: string,
    fromCurrency: string,
    toCurrency: string,
    asOf: string | Date,
  ): Promise<MoneyConversionResultDto> {
    return this.convert({
      amount,
      fromCurrency,
      toCurrency,
      asOf,
      forDisplay: false,
    });
  }

  /**
   * Apply a known rate (payment/invoice FX snapshot). Does not load from DB.
   */
  convertWithExplicitRate(input: {
    amount: string;
    fromCurrency: string;
    toCurrency: string;
    rate: string;
    effectiveAt: string;
    fetchedAt?: string;
    source?: MoneyConversionResultDto['source'];
    provider?: string | null;
    rateId?: string | null;
    forDisplay?: boolean;
  }): MoneyConversionResultDto {
    const from = assertSupportedCurrency(input.fromCurrency);
    const to = assertSupportedCurrency(input.toCurrency);
    let original;
    try {
      original = money(input.amount);
    } catch {
      throw new BadRequestException('Invalid amount');
    }

    if (from === to) {
      return {
        status: 'identity',
        originalAmount: asMoneyString(original),
        originalCurrency: from,
        convertedAmount: asMoneyString(original),
        convertedCurrency: to,
        exchangeRate: '1',
        effectiveAt: input.effectiveAt,
        fetchedAt: input.fetchedAt ?? input.effectiveAt,
        source: 'IDENTITY',
        provider: 'identity',
        rateId: null,
        isDisplayConversion: input.forDisplay ?? false,
      };
    }

    let rate;
    try {
      rate = money(input.rate);
    } catch {
      throw new BadRequestException('Invalid exchange rate');
    }
    if (!rate.isFinite() || rate.lte(0)) {
      throw new BadRequestException('Exchange rate must be positive');
    }

    const converted = convertWithRate(original, rate);
    const convertedAmount =
      input.forDisplay === true
        ? asDisplayMoneyString(converted)
        : asMoneyString(converted);

    return {
      status: 'converted',
      originalAmount: asMoneyString(original),
      originalCurrency: from,
      convertedAmount,
      convertedCurrency: to,
      exchangeRate: rate.toDecimalPlaces(8).toFixed(),
      effectiveAt: input.effectiveAt,
      fetchedAt: input.fetchedAt ?? input.effectiveAt,
      source: input.source ?? null,
      provider: input.provider ?? null,
      rateId: input.rateId ?? null,
      isDisplayConversion: input.forDisplay ?? false,
    };
  }

  async convert(input: ConvertMoneyInput): Promise<MoneyConversionResultDto> {
    const from = assertSupportedCurrency(input.fromCurrency);
    const to = assertSupportedCurrency(input.toCurrency);
    const forDisplay = input.forDisplay ?? input.asOf == null;

    let original;
    try {
      original = money(input.amount);
    } catch {
      throw new BadRequestException('Invalid amount');
    }

    if (from === to) {
      return {
        status: 'identity',
        originalAmount: asMoneyString(original),
        originalCurrency: from,
        convertedAmount: asMoneyString(original),
        convertedCurrency: to,
        exchangeRate: '1',
        effectiveAt: null,
        fetchedAt: null,
        source: 'IDENTITY',
        provider: 'identity',
        rateId: null,
        isDisplayConversion: forDisplay,
      };
    }

    const rateRow = await this.exchangeRates.resolveRate({
      baseCurrency: from,
      quoteCurrency: to,
      asOf: input.asOf,
    });

    if (!rateRow) {
      return {
        status: 'unavailable',
        originalAmount: asMoneyString(original),
        originalCurrency: from,
        convertedAmount: null,
        convertedCurrency: to,
        exchangeRate: null,
        effectiveAt: null,
        fetchedAt: null,
        source: null,
        provider: null,
        rateId: null,
        isDisplayConversion: forDisplay,
      };
    }

    return this.convertWithExplicitRate({
      amount: input.amount,
      fromCurrency: from,
      toCurrency: to,
      rate: rateRow.rate,
      effectiveAt: rateRow.effectiveAt,
      fetchedAt: rateRow.fetchedAt,
      source: rateRow.id === 'identity' ? 'IDENTITY' : rateRow.source,
      provider: rateRow.provider,
      rateId: rateRow.id.startsWith('identity') ? null : rateRow.id,
      forDisplay,
    });
  }

  /** Batch helper for dashboards — converts many amounts to one display currency. */
  async convertMany(
    items: Array<{ amount: string; currency: string }>,
    toCurrency: string,
  ): Promise<MoneyConversionResultDto[]> {
    const results: MoneyConversionResultDto[] = [];
    for (const item of items) {
      results.push(
        await this.convertForDisplay(item.amount, item.currency, toCurrency),
      );
    }
    return results;
  }
}
