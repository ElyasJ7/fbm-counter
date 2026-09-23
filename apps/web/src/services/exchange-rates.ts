import type {
  ExchangeRateDto,
  ExchangeRatesLatestDto,
  MoneyConversionResultDto,
} from '@fbm/shared';
import { apiRequest } from '../lib/api';

export function fetchLatestExchangeRates() {
  return apiRequest<ExchangeRatesLatestDto>('/exchange-rates/latest');
}

export function refreshExchangeRates() {
  return apiRequest<ExchangeRatesLatestDto>('/exchange-rates/refresh', {
    method: 'POST',
  });
}

export function createManualExchangeRate(input: {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  reason: string;
  effectiveAt?: string;
}) {
  return apiRequest<ExchangeRateDto>('/exchange-rates/manual', {
    method: 'POST',
    body: input,
  });
}

/** Display conversion via existing CurrencyConversionService (cached rate). */
export function convertMoney(input: {
  amount: string;
  fromCurrency: string;
  toCurrency: string;
}) {
  const params = new URLSearchParams({
    amount: input.amount,
    from: input.fromCurrency,
    to: input.toCurrency,
  });
  return apiRequest<MoneyConversionResultDto>(
    `/exchange-rates/convert?${params.toString()}`,
  );
}
