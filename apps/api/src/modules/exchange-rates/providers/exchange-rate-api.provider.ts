import { Injectable, Logger } from '@nestjs/common';
import { money, type Decimal } from '@fbm/financial-core';
import type {
  ExchangeRateProvider,
  FetchLatestResult,
} from './exchange-rate.provider';

/**
 * ExchangeRate-API v6 (https://www.exchangerate-api.com/).
 * Supports arbitrary base currencies including AFN when the plan allows.
 */
@Injectable()
export class ExchangeRateApiProvider implements ExchangeRateProvider {
  readonly name = 'exchangerate-api';
  private readonly logger = new Logger(ExchangeRateApiProvider.name);

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = 'https://v6.exchangerate-api.com/v6',
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async fetchLatest(currencies: readonly string[]): Promise<FetchLatestResult> {
    if (!this.isConfigured()) {
      throw new Error('ExchangeRate-API key is not configured');
    }

    // Fetch from USD pivot for consistent cross-rates among AFN/EUR/USD
    const url = `${this.baseUrl}/${this.apiKey!.trim()}/latest/USD`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `ExchangeRate-API HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
      throw new Error(`ExchangeRate-API request failed (${response.status})`);
    }

    const json = (await response.json()) as {
      result?: string;
      time_last_update_unix?: number;
      conversion_rates?: Record<string, number>;
    };

    if (json.result && json.result !== 'success') {
      throw new Error(`ExchangeRate-API result=${json.result}`);
    }
    if (!json.conversion_rates) {
      throw new Error('ExchangeRate-API response missing conversion_rates');
    }

    const fetchedAt = new Date();
    const effectiveAt = json.time_last_update_unix
      ? new Date(json.time_last_update_unix * 1000)
      : fetchedAt;

    const pivotRates: Record<string, Decimal> = { USD: money(1) };
    for (const code of currencies) {
      const upper = code.toUpperCase();
      const value = json.conversion_rates[upper];
      if (value != null) {
        pivotRates[upper] = money(value);
      }
    }

    void effectiveAt;
    return {
      provider: this.name,
      fetchedAt,
      pivotCurrency: 'USD',
      pivotRates,
      quotes: [],
    };
  }
}
