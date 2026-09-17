import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { roleHasPermission } from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/ui/FormSection';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
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
  defaultCurrency: 'EUR',
  defaultVatRate: '19',
  invoicePrefix: 'RE',
};

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

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    enabled: canRead,
    retry: false,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      companyName: query.data.companyName,
      legalName: query.data.legalName ?? '',
      street: query.data.street ?? '',
      postalCode: query.data.postalCode ?? '',
      city: query.data.city ?? '',
      country: query.data.country,
      vatId: query.data.vatId ?? '',
      taxNumber: query.data.taxNumber ?? '',
      iban: query.data.iban ?? '',
      bic: query.data.bic ?? '',
      defaultCurrency: query.data.defaultCurrency,
      defaultVatRate: query.data.defaultVatRate,
      invoicePrefix: query.data.invoicePrefix,
    });
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
        defaultCurrency: form.defaultCurrency?.trim().toUpperCase() || 'EUR',
        defaultVatRate: form.defaultVatRate?.trim() || '19',
        invoicePrefix: form.invoicePrefix?.trim().toUpperCase() || 'RE',
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
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Company profile and application preferences."
        />
        <EmptyState
          title="No access"
          description="Your role cannot view company settings."
        />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Company profile and application preferences."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-32 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Company profile and application preferences."
        />
        <Alert tone="danger" title="Could not load settings">
          {query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'}
        </Alert>
      </div>
    );
  }

  const settings = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company profile and application preferences."
        actions={
          canWrite && !editing ? (
            <Button
              onClick={() => {
                setEditing(true);
                setFormError(null);
              }}
            >
              Edit
            </Button>
          ) : null
        }
      />

      {editing && canWrite ? (
        <Card title="Edit company settings">
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <FormSection title="Company profile">
              <Input
                label="Company name"
                name="companyName"
                value={form.companyName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, companyName: e.target.value }))
                }
                required
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

            <FormSection title="Defaults">
              <Input
                label="Default currency"
                name="defaultCurrency"
                value={form.defaultCurrency ?? 'EUR'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultCurrency: e.target.value,
                  }))
                }
              />
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
                label="Invoice prefix (outgoing)"
                name="invoicePrefix"
                value={form.invoicePrefix ?? 'RE'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    invoicePrefix: e.target.value,
                  }))
                }
              />
            </FormSection>
            <p className="-mt-4 text-xs text-muted">
              The invoice prefix applies to outgoing invoices. Incoming invoices
              continue to use ER.
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
                    setForm({
                      companyName: query.data.companyName,
                      legalName: query.data.legalName ?? '',
                      street: query.data.street ?? '',
                      postalCode: query.data.postalCode ?? '',
                      city: query.data.city ?? '',
                      country: query.data.country,
                      vatId: query.data.vatId ?? '',
                      taxNumber: query.data.taxNumber ?? '',
                      iban: query.data.iban ?? '',
                      bic: query.data.bic ?? '',
                      defaultCurrency: query.data.defaultCurrency,
                      defaultVatRate: query.data.defaultVatRate,
                      invoicePrefix: query.data.invoicePrefix,
                    });
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

          <Card title="Defaults" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Default currency" value={settings.defaultCurrency} />
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
