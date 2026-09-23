import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_LABELS,
  DEFAULT_CURRENCY,
  DEFAULT_DISPLAY_CURRENCY,
  DEFAULT_TIMEZONE,
  roleHasPermission,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  TIMEZONE_LABELS,
  type SupportedCurrency,
  type SupportedTimezone,
} from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatDateDe } from '../lib/format';
import {
  fetchLatestExchangeRates,
  refreshExchangeRates,
} from '../services/exchange-rates';
import {
  fetchSettings,
  updateSettings,
  type SettingsInput,
} from '../services/settings';

const emptyForm: SettingsInput = {
  companyName: '',
  legalName: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  taxNumber: '',
  iban: '',
  bic: '',
  defaultCurrency: DEFAULT_CURRENCY,
  defaultDisplayCurrency: DEFAULT_DISPLAY_CURRENCY,
  timezone: DEFAULT_TIMEZONE,
  defaultVatRate: '19',
  invoicePrefix: 'INV',
};

function settingsToForm(data: {
  companyName: string;
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  vatId: string | null;
  taxNumber: string | null;
  iban: string | null;
  bic: string | null;
  defaultCurrency: string;
  defaultDisplayCurrency: string;
  timezone: string;
  defaultVatRate: string;
  invoicePrefix: string;
}): SettingsInput {
  return {
    companyName: data.companyName,
    legalName: data.legalName ?? '',
    street: data.street ?? '',
    postalCode: data.postalCode ?? '',
    city: data.city ?? '',
    country: data.country,
    vatId: data.vatId ?? '',
    taxNumber: data.taxNumber ?? '',
    iban: data.iban ?? '',
    bic: data.bic ?? '',
    defaultCurrency: data.defaultCurrency,
    defaultDisplayCurrency: data.defaultDisplayCurrency,
    timezone: data.timezone,
    defaultVatRate: data.defaultVatRate,
    invoicePrefix: data.invoicePrefix,
  };
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink">{value?.trim() || '—'}</p>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canRead = user
    ? roleHasPermission(user.role, 'settings:read')
    : false;
  const canWrite = user
    ? roleHasPermission(user.role, 'settings:write')
    : false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SettingsInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const currencyOptions = useMemo(
    () =>
      SUPPORTED_CURRENCIES.map((code) => ({
        value: code,
        label: CURRENCY_LABELS[code],
      })),
    [],
  );

  const timezoneOptions = useMemo(
    () =>
      SUPPORTED_TIMEZONES.map((tz) => ({
        value: tz,
        label: TIMEZONE_LABELS[tz],
      })),
    [],
  );

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: canRead,
    retry: false,
  });

  const ratesQuery = useQuery({
    queryKey: ['exchange-rates', 'latest'],
    queryFn: fetchLatestExchangeRates,
    enabled: canRead,
    retry: false,
  });

  const canManageFx =
    user?.role === 'ADMIN' || user?.role === 'MANAGEMENT';

  const refreshRatesMutation = useMutation({
    mutationFn: refreshExchangeRates,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setForm(settingsToForm(query.data));
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<SettingsInput> = {
        companyName: form.companyName.trim(),
        legalName: form.legalName?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim().toUpperCase() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        iban: form.iban?.trim() || undefined,
        bic: form.bic?.trim() || undefined,
        defaultCurrency: (form.defaultCurrency?.trim().toUpperCase() ||
          DEFAULT_CURRENCY) as SupportedCurrency,
        defaultDisplayCurrency: (form.defaultDisplayCurrency
          ?.trim()
          .toUpperCase() || DEFAULT_DISPLAY_CURRENCY) as SupportedCurrency,
        timezone: (form.timezone?.trim() ||
          DEFAULT_TIMEZONE) as SupportedTimezone,
        defaultVatRate: form.defaultVatRate?.trim() || '19',
        invoicePrefix: form.invoicePrefix?.trim().toUpperCase() || 'INV',
      };
      return updateSettings(payload);
    },
    onSuccess: async () => {
      setEditing(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Save failed',
      );
    },
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          title="No access"
          description="Your role cannot view company settings."
        />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div>
        <PageHeader title="Settings" />
        <SkeletonCard />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          title="Could not load settings"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
        />
      </div>
    );
  }

  const settings = query.data;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company profile, currency, region, and invoice defaults."
        actions={
          canWrite && !editing ? (
            <Button type="button" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null
        }
      />

      {editing && canWrite ? (
        <Card title="Edit settings">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <FormSection title="Company">
              <Input
                label="Company name"
                name="companyName"
                required
                value={form.companyName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, companyName: e.target.value }))
                }
              />
              <Input
                label="Legal name"
                name="legalName"
                value={form.legalName ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, legalName: e.target.value }))
                }
              />
            </FormSection>

            <FormSection title="Address">
              <Input
                label="Street"
                name="street"
                value={form.street ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, street: e.target.value }))
                }
              />
              <Input
                label="Postal code"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                }
              />
              <Input
                label="City"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
              <Input
                label="Country"
                name="country"
                value={form.country ?? 'DE'}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, country: e.target.value }))
                }
              />
            </FormSection>

            <FormSection title="Tax">
              <Input
                label="VAT ID"
                name="vatId"
                value={form.vatId ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, vatId: e.target.value }))
                }
              />
              <Input
                label="Tax number"
                name="taxNumber"
                value={form.taxNumber ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, taxNumber: e.target.value }))
                }
              />
            </FormSection>

            <FormSection title="Bank details">
              <Input
                label="IBAN"
                name="iban"
                value={form.iban ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, iban: e.target.value }))
                }
              />
              <Input
                label="BIC"
                name="bic"
                value={form.bic ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bic: e.target.value }))
                }
              />
            </FormSection>

            <FormSection title="Currency & region">
              <Select
                label="Base currency"
                name="defaultCurrency"
                hint="Books and accounting home currency. Changing this does not rewrite historical amounts."
                value={form.defaultCurrency ?? DEFAULT_CURRENCY}
                options={currencyOptions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultCurrency: e.target.value,
                  }))
                }
              />
              <Select
                label="Default display currency"
                name="defaultDisplayCurrency"
                hint="Default UI reporting currency (user preference comes later)."
                value={form.defaultDisplayCurrency ?? DEFAULT_DISPLAY_CURRENCY}
                options={currencyOptions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultDisplayCurrency: e.target.value,
                  }))
                }
              />
              <Select
                label="Timezone"
                name="timezone"
                hint="Regional preference. Business calendar dates stay date-only / UTC-safe."
                value={form.timezone ?? DEFAULT_TIMEZONE}
                options={timezoneOptions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    timezone: e.target.value,
                  }))
                }
              />
            </FormSection>

            <FormSection title="Invoice defaults">
              <Input
                label="Default VAT %"
                name="defaultVatRate"
                value={form.defaultVatRate ?? '19'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultVatRate: e.target.value,
                  }))
                }
              />
              <Input
                label="Invoice prefix (customer invoices)"
                name="invoicePrefix"
                value={form.invoicePrefix ?? 'INV'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    invoicePrefix: e.target.value,
                  }))
                }
              />
            </FormSection>
            <p className="-mt-4 text-xs text-muted">
              The invoice prefix applies to customer invoices. Supplier invoices
              continue to use the SI prefix. Supported currencies: AFN, EUR,
              USD.
            </p>

            {formError ? <Alert tone="danger">{formError}</Alert> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setFormError(null);
                  if (query.data) {
                    setForm(settingsToForm(query.data));
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Company profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" value={settings.companyName} />
              <Field label="Legal name" value={settings.legalName} />
              <Field label="Street" value={settings.street} />
              <Field label="Postal code" value={settings.postalCode} />
              <Field label="City" value={settings.city} />
              <Field label="Country" value={settings.country} />
            </div>
          </Card>

          <Card title="Tax & bank">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="VAT ID" value={settings.vatId} />
              <Field label="Tax number" value={settings.taxNumber} />
              <Field label="IBAN" value={settings.iban} />
              <Field label="BIC" value={settings.bic} />
            </div>
          </Card>

          <Card title="Currency & region" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Base currency"
                value={
                  CURRENCY_LABELS[
                    settings.defaultCurrency as SupportedCurrency
                  ] ?? settings.defaultCurrency
                }
              />
              <Field
                label="Default display currency"
                value={
                  CURRENCY_LABELS[
                    settings.defaultDisplayCurrency as SupportedCurrency
                  ] ?? settings.defaultDisplayCurrency
                }
              />
              <Field
                label="Timezone"
                value={
                  TIMEZONE_LABELS[settings.timezone as SupportedTimezone] ??
                  settings.timezone
                }
              />
            </div>
          </Card>

          <Card
            title="Exchange rates"
            className="lg:col-span-2"
            actions={
              canManageFx ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    refreshRatesMutation.isPending ||
                    ratesQuery.data?.providerConfigured === false
                  }
                  onClick={() => refreshRatesMutation.mutate()}
                >
                  {refreshRatesMutation.isPending
                    ? 'Refreshing…'
                    : 'Refresh rates'}
                </Button>
              ) : null
            }
          >
            {ratesQuery.isLoading ? (
              <p className="text-sm text-muted">Loading rates…</p>
            ) : null}
            {ratesQuery.error ? (
              <Alert tone="danger">
                {ratesQuery.error instanceof ApiError
                  ? ratesQuery.error.message
                  : 'Could not load exchange rates'}
              </Alert>
            ) : null}
            {ratesQuery.data ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  {ratesQuery.data.providerConfigured
                    ? 'Live FX provider is configured.'
                    : 'No live FX provider configured (FX_PROVIDER=none). Cached or manual rates still apply.'}
                  {ratesQuery.data.lastUpdatedAt
                    ? ` Last updated: ${formatDateDe(ratesQuery.data.lastUpdatedAt.slice(0, 10))} ${ratesQuery.data.lastUpdatedAt.slice(11, 16)} UTC.`
                    : ' No rates stored yet.'}
                </p>
                {refreshRatesMutation.error ? (
                  <Alert tone="danger">
                    {refreshRatesMutation.error instanceof ApiError
                      ? refreshRatesMutation.error.message
                      : 'Refresh failed'}
                  </Alert>
                ) : null}
                {ratesQuery.data.rates.length === 0 ? (
                  <p className="text-sm text-muted">
                    No exchange rates available. Configure FX_PROVIDER /
                    FX_API_KEY and refresh, or wait for Phase D+ conversion UI.
                  </p>
                ) : (
                  <div className="table-scroll">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[var(--color-border)] text-muted">
                        <tr>
                          <th className="px-2 py-2 font-medium">Pair</th>
                          <th className="px-2 py-2 font-medium">Rate</th>
                          <th className="px-2 py-2 font-medium">Source</th>
                          <th className="px-2 py-2 font-medium">Provider</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratesQuery.data.rates.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100"
                          >
                            <td className="px-2 py-2 font-medium">
                              1 {row.baseCurrency} → {row.quoteCurrency}
                            </td>
                            <td className="px-2 py-2">{row.rate}</td>
                            <td className="px-2 py-2">{row.source}</td>
                            <td className="px-2 py-2">{row.provider}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </Card>

          <Card title="Invoice defaults" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Default VAT"
                value={`${settings.defaultVatRate} %`}
              />
              <Field
                label="Invoice prefix"
                value={settings.invoicePrefix}
              />
            </div>
            {!canWrite ? (
              <p className="mt-4 text-xs text-muted">
                Only administrators can change settings.
              </p>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
