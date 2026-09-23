import { Injectable } from '@nestjs/common';
import type {
  ExchangeRateProvider,
  FetchLatestResult,
} from './exchange-rate.provider';

/** Used when FX_PROVIDER is unset/none — refresh is a no-op at the provider layer. */
@Injectable()
export class NoopExchangeRateProvider implements ExchangeRateProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return false;
  }

  fetchLatest(_currencies: readonly string[]): Promise<FetchLatestResult> {
    void _currencies;
    return Promise.reject(
      new Error(
        'FX provider is not configured. Set FX_PROVIDER and FX_API_KEY to enable live rates.',
      ),
    );
  }
}
