import type { CompanySettingsDto } from '@fbm/shared';
import { apiRequest } from '../lib/api';

export type SettingsInput = {
  companyName: string;
  legalName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  vatId?: string;
  taxNumber?: string;
  iban?: string;
  bic?: string;
  /** Company base / books currency. */
  defaultCurrency?: string;
  /** Default UI display currency. */
  defaultDisplayCurrency?: string;
  timezone?: string;
  defaultVatRate?: string;
  invoicePrefix?: string;
};

export function fetchSettings() {
  return apiRequest<CompanySettingsDto>('/settings');
}

export function updateSettings(input: Partial<SettingsInput>) {
  return apiRequest<CompanySettingsDto>('/settings', {
    method: 'PATCH',
    body: input,
  });
}
