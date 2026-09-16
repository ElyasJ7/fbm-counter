import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  roleHasPermission,
  SUBCONTRACTOR_TRADES,
  SUBCONTRACTOR_TRADE_LABELS,
  type SubcontractorTrade,
} from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency } from '../lib/format';
import {
  createSubcontractor,
  deleteSubcontractor,
  fetchSubcontractors,
  updateSubcontractor,
  type SubcontractorInput,
} from '../services/partners';

const emptyForm: SubcontractorInput = {
  companyName: '',
  contactPerson: '',
  trade: 'OTHER',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: 'DE',
  vatId: '',
  taxNumber: '',
  contractValue: '0',
  notes: '',
};

const tradeOptions = SUBCONTRACTOR_TRADES.map((trade) => ({
  value: trade,
  label: SUBCONTRACTOR_TRADE_LABELS[trade],
}));

export function SubcontractorsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'subcontractors:write')
    : false;

  const [search, setSearch] = useState('');
  const [trade, setTrade] = useState<SubcontractorTrade | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubcontractorInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['subcontractors', page, search, trade],
    queryFn: () =>
      fetchSubcontractors({ page, pageSize: 20, search, trade }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: SubcontractorInput = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        trade: form.trade,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        contractValue: form.contractValue?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      if (editingId) {
        return updateSubcontractor(editingId, payload);
      }
      return createSubcontractor(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubcontractor(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
  });

  const title = useMemo(
    () => (editingId ? 'Nachunternehmer bearbeiten' : 'Neuer Nachunternehmer'),
    [editingId],
  );

  return (
    <div>
      <PageHeader
        title="Nachunternehmer"
        description="Gewerke-Partner mit Projektzuordnung und Verträgen."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(true);
                setFormError(null);
              }}
            >
              Neuer Nachunternehmer
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
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
        <Select
          label="Gewerk"
          name="tradeFilter"
          value={trade}
          placeholder="Alle Gewerke"
          options={tradeOptions}
          onChange={(e) => {
            setTrade((e.target.value as SubcontractorTrade | '') || '');
            setPage(1);
          }}
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
            <Select
              label="Gewerk"
              name="trade"
              required
              value={form.trade}
              options={tradeOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  trade: e.target.value as SubcontractorTrade,
                }))
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
              label="Vertragswert"
              name="contractValue"
              value={form.contractValue ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contractValue: e.target.value }))
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
              label="Steuernummer"
              name="taxNumber"
              value={form.taxNumber ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxNumber: e.target.value }))
              }
            />
            <Input
              label="Notizen"
              name="notes"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
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
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
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
          title="Nachunternehmer konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Noch keine Nachunternehmer"
          description="Legen Sie Nachunternehmer an und ordnen Sie sie Projekten zu."
          actionLabel={canWrite ? 'Neuer Nachunternehmer' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm(emptyForm);
                  setEditingId(null);
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
                  <th className="px-3 py-2 font-medium">Gewerk</th>
                  <th className="px-3 py-2 font-medium">Kontakt</th>
                  <th className="px-3 py-2 font-medium">Stadt</th>
                  <th className="px-3 py-2 font-medium">Vertragswert</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      <Link
                        className="text-[var(--color-brand)] hover:underline"
                        to={`/subcontractors/${row.id}`}
                      >
                        {row.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {SUBCONTRACTOR_TRADE_LABELS[row.trade]}
                    </td>
                    <td className="px-3 py-3">{row.contactPerson ?? '—'}</td>
                    <td className="px-3 py-3">{row.city ?? '—'}</td>
                    <td className="px-3 py-3">
                      {formatCurrency(row.contractValue)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/subcontractors/${row.id}`}
                        >
                          Details
                        </Link>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-slate-700 hover:underline"
                            onClick={() => {
                              setEditingId(row.id);
                              setForm({
                                companyName: row.companyName,
                                contactPerson: row.contactPerson ?? '',
                                trade: row.trade,
                                email: row.email ?? '',
                                phone: row.phone ?? '',
                                street: row.street ?? '',
                                postalCode: row.postalCode ?? '',
                                city: row.city ?? '',
                                country: row.country,
                                vatId: row.vatId ?? '',
                                taxNumber: row.taxNumber ?? '',
                                contractValue: row.contractValue,
                                notes: row.notes ?? '',
                              });
                              setShowForm(true);
                              setFormError(null);
                            }}
                          >
                            Bearbeiten
                          </button>
                        ) : null}
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Nachunternehmer „${row.companyName}“ löschen?`,
                                )
                              ) {
                                deleteMutation.mutate(row.id);
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
