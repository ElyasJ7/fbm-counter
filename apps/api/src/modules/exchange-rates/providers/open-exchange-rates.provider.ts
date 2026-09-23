import { Injectable, Logger } from '@nestjs/common';
import { money, type Decimal } from '@fbm/financial-core';
import type {
  ExchangeRateProvider,
  FetchLatestResult,
} from './exchange-rate.provider';

/**
 * Open Exchange Rates (https://openexchangerates.org).
 * Free plans typically fix base=USD.
 */
@Injectable()
export class OpenExchangeRatesProvider implements ExchangeRateProvider {
  readonly name = 'openexchangerates';
  private readonly logger = new Logger(OpenExchangeRatesProvider.name);

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = 'https://openexchangerates.org/api',
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async fetchLatest(currencies: readonly string[]): Promise<FetchLatestResult> {
    if (!this.isConfigured()) {
      throw new Error('Open Exchange Rates API key is not configured');
    }

    const url = new URL(`${this.baseUrl}/latest.json`);
    url.searchParams.set('app_id', this.apiKey!.trim());
    // Free tier: USD base only
    url.searchParams.set('base', 'USD');
    url.searchParams.set(
      'symbols',
      [...new Set(['USD', ...currencies])].join(','),
    );

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Open Exchange Rates HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
      throw new Error(
        `Open Exchange Rates request failed (${response.status})`,
      );
    }

    const json = (await response.json()) as {
      timestamp?: number;
      base?: string;
      rates?: Record<string, number>;
    };

    if (!json.rates || typeof json.rates !== 'object') {
      throw new Error('Open Exchange Rates response missing rates');
    }

    const fetchedAt = json.timestamp
      ? new Date(json.timestamp * 1000)
      : new Date();

    const pivotRates: Record<string, Decimal> = { USD: money(1) };
    for (const [code, value] of Object.entries(json.rates)) {
      pivotRates[code.toUpperCase()] = money(value);
    }

    return {
      provider: this.name,
      fetchedAt,
      pivotCurrency: 'USD',
      pivotRates,
      quotes: [],
    };
  }
}
