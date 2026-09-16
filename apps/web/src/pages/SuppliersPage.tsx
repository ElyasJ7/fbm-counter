import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { roleHasPermission } from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency } from '../lib/format';
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  type SupplierInput,
} from '../services/partners';

const emptyForm: SupplierInput = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  iban: '',
  paymentTerms: '',
};

export function SuppliersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'suppliers:write')
    : false;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => fetchSuppliers({ page, pageSize: 20, search }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: SupplierInput = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        iban: form.iban?.trim() || undefined,
        paymentTerms: form.paymentTerms?.trim() || undefined,
      };
      return createSupplier(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm(emptyForm);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const title = useMemo(() => 'Neuer Lieferant', []);
  const hasTotals = Boolean(
    query.data?.data.some((supplier) => supplier.totals),
  );

  return (
    <div>
      <PageHeader
        title="Lieferanten"
        description="Stammdaten für Lieferanten und Einkauf."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm(emptyForm);
                setShowForm(true);
                setFormError(null);
              }}
            >
              Neuer Lieferant
            </Button>
          ) : null
        }
      />

      <div className="mb-4">
        <Input
          label="Suche"
          name="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Firma, Kontakt, Stadt…"
        />
      </div>

      {showForm && canWrite ? (
        <Card className="mb-6" title={title}>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Firmenname"
              name="companyName"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, companyName: e.target.value }))
              }
            />
            <Input
              label="Ansprechpartner"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactPerson: e.target.value }))
              }
            />
            <Input
              label="E-Mail"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              label="Telefon"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
            <Input
              label="Straße"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, street: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="PLZ"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                }
              />
              <Input
                label="Stadt"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <Input
              label="USt-IdNr."
              name="vatId"
              value={form.vatId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vatId: e.target.value }))
              }
            />
            <Input
              label="IBAN"
              name="iban"
              value={form.iban ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, iban: e.target.value }))
              }
            />
            <Input
              label="Zahlungsbedingungen"
              name="paymentTerms"
              value={form.paymentTerms ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentTerms: e.target.value }))
              }
            />
            {formError ? (
              <p className="md:col-span-2 text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Speichern
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error ? (
        <EmptyState
          title="Lieferanten konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Noch keine Lieferanten"
          description="Legen Sie einen Lieferanten an, um Ausgaben und Eingangsrechnungen zuzuordnen."
          actionLabel={canWrite ? 'Neuer Lieferant' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm(emptyForm);
                }
              : undefined
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Firma</th>
                  <th className="px-3 py-2 font-medium">Kontakt</th>
                  <th className="px-3 py-2 font-medium">Stadt</th>
                  <th className="px-3 py-2 font-medium">E-Mail</th>
                  {hasTotals ? (
                    <>
                      <th className="px-3 py-2 font-medium">Einkäufe</th>
                      <th className="px-3 py-2 font-medium">Bezahlt</th>
                      <th className="px-3 py-2 font-medium">Offen</th>
                    </>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      <Link
                        className="text-[var(--color-brand)] hover:underline"
                        to={`/suppliers/${supplier.id}`}
                      >
                        {supplier.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {supplier.contactPerson ?? '—'}
                    </td>
                    <td className="px-3 py-3">{supplier.city ?? '—'}</td>
                    <td className="px-3 py-3">{supplier.email ?? '—'}</td>
                    {hasTotals ? (
                      <>
                        <td className="px-3 py-3">
                          {supplier.totals
                            ? formatCurrency(supplier.totals.totalPurchases)
                            : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {supplier.totals
                            ? formatCurrency(supplier.totals.paidAmount)
                            : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {supplier.totals
                            ? formatCurrency(
                                supplier.totals.outstandingBalance,
                              )
                            : '—'}
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/suppliers/${supplier.id}`}
                        >
                          Details
                        </Link>
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/expenses?search=${encodeURIComponent(supplier.companyName)}`}
                        >
                          Ausgaben
                        </Link>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Lieferant „${supplier.companyName}“ löschen?`,
                                )
                              ) {
                                deleteMutation.mutate(supplier.id);
                              }
                            }}
                          >
                            Löschen
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
            <span>
              Seite {query.data.meta.page} von {query.data.meta.totalPages} (
              {query.data.meta.total} gesamt)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Zurück
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
