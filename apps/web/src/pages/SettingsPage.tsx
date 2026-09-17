import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { roleHasPermission } from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
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
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--color-ink)]">{value?.trim() || '—'}</p>
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
        error instanceof ApiError ? error.message : 'Speichern fehlgeschlagen',
      );
    },
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Einstellungen"
          description="Unternehmensprofil und Systemkonfiguration."
        />
        <EmptyState
          title="Kein Zugriff"
          description="Ihre Rolle darf Firmeneinstellungen nicht einsehen."
        />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div>
        <PageHeader
          title="Einstellungen"
          description="Unternehmensprofil und Systemkonfiguration."
        />
        <EmptyState
          title="Einstellungen konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      </div>
    );
  }

  const settings = query.data;

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        description="Firmenprofil, Steuerdaten und Systemvorgaben."
        actions={
          canWrite && !editing ? (
            <Button
              onClick={() => {
                setEditing(true);
                setFormError(null);
              }}
            >
              Bearbeiten
            </Button>
          ) : null
        }
      />

      {editing && canWrite ? (
        <Card title="Firmeneinstellungen bearbeiten">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Unternehmensprofil
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Firmenname"
                  name="companyName"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, companyName: e.target.value }))
                  }
                  required
                />
                <Input
                  label="Rechtlicher Name"
                  name="legalName"
                  value={form.legalName ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, legalName: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Adresse
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Straße"
                  name="street"
                  value={form.street ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, street: e.target.value }))
                  }
                />
                <Input
                  label="PLZ"
                  name="postalCode"
                  value={form.postalCode ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                  }
                />
                <Input
                  label="Ort"
                  name="city"
                  value={form.city ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
                <Input
                  label="Land"
                  name="country"
                  value={form.country ?? 'DE'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, country: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Steuern
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="USt-IdNr."
                  name="vatId"
                  value={form.vatId ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, vatId: e.target.value }))
                  }
                />
                <Input
                  label="Steuernummer"
                  name="taxNumber"
                  value={form.taxNumber ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, taxNumber: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Bankverbindung
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
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
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Systemvorgaben
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  label="Standardwährung"
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
                  label="Standard-MwSt. %"
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
                  label="Rechnungspräfix (Ausgang)"
                  name="invoicePrefix"
                  value={form.invoicePrefix ?? 'RE'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      invoicePrefix: e.target.value,
                    }))
                  }
                />
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Der Rechnungspräfix gilt für Ausgangsrechnungen. Eingangsrechnungen
                nutzen weiterhin ER.
              </p>
            </div>

            {formError ? (
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Speichern…' : 'Speichern'}
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
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Unternehmensprofil">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Firmenname" value={settings.companyName} />
              <Field label="Rechtlicher Name" value={settings.legalName} />
              <Field label="Straße" value={settings.street} />
              <Field label="PLZ" value={settings.postalCode} />
              <Field label="Ort" value={settings.city} />
              <Field label="Land" value={settings.country} />
            </div>
          </Card>

          <Card title="Steuern & Bank">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="USt-IdNr." value={settings.vatId} />
              <Field label="Steuernummer" value={settings.taxNumber} />
              <Field label="IBAN" value={settings.iban} />
              <Field label="BIC" value={settings.bic} />
            </div>
          </Card>

          <Card title="Systemvorgaben" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Standardwährung" value={settings.defaultCurrency} />
              <Field
                label="Standard-MwSt."
                value={`${settings.defaultVatRate} %`}
              />
              <Field
                label="Rechnungspräfix"
                value={settings.invoicePrefix}
              />
            </div>
            {!canWrite ? (
              <p className="mt-4 text-xs text-[var(--color-muted)]">
                Nur Administratoren können Einstellungen ändern.
              </p>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
