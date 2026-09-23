import type { MoneyConversionResultDto } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export function convertMoneyPreview(input: {
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  asOf?: string;
}) {
  const params = new URLSearchParams({
    amount: input.amount,
    from: input.fromCurrency,
    to: input.toCurrency,
  });
  if (input.asOf) params.set('asOf', input.asOf);
  return apiRequest<MoneyConversionResultDto>(
    `/exchange-rates/convert?${params.toString()}`,
  );
}

export function convertMoneyPost(input: {
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  asOf?: string;
}) {
  return apiRequest<MoneyConversionResultDto>('/exchange-rates/convert', {
    method: 'POST',
    body: input,
  });
}
