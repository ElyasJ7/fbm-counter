import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  roleHasPermission,
  SUBCONTRACTOR_TRADES,
  SUBCONTRACTOR_TRADE_LABELS,
  type SubcontractorTrade,
} from '@fbm/shared';
import { InvoiceStatusBadge } from '../components/finance/StatusBadges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import {
  assignSubcontractorProject,
  fetchSubcontractor,
  unassignSubcontractorProject,
  updateSubcontractor,
  type SubcontractorInput,
} from '../services/partners';
import { fetchProjects } from '../services/projects';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-slate-50 p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}

const tradeOptions = SUBCONTRACTOR_TRADES.map((trade) => ({
  value: trade,
  label: SUBCONTRACTOR_TRADE_LABELS[trade],
}));

export function SubcontractorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'subcontractors:write')
    : false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SubcontractorInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignContractValue, setAssignContractValue] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => fetchSubcontractor(id),
    enabled: Boolean(id),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'assign-options'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: canWrite,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      companyName: query.data.companyName,
      contactPerson: query.data.contactPerson ?? '',
      trade: query.data.trade,
      email: query.data.email ?? '',
      phone: query.data.phone ?? '',
      street: query.data.street ?? '',
      postalCode: query.data.postalCode ?? '',
      city: query.data.city ?? '',
      country: query.data.country,
      vatId: query.data.vatId ?? '',
      taxNumber: query.data.taxNumber ?? '',
      contractValue: query.data.contractValue,
      notes: query.data.notes ?? '',
    });
  }, [query.data]);

  const assignedProjectIds = useMemo(
    () => new Set(query.data?.projects.map((link) => link.project.id) ?? []),
    [query.data],
  );

  const projectOptions = useMemo(
    () =>
      (projectsQuery.data?.data ?? [])
        .filter((project) => !assignedProjectIds.has(project.id))
        .map((project) => ({
          value: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        })),
    [projectsQuery.data, assignedProjectIds],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Form not ready');
      const payload: Partial<SubcontractorInput> = {
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
      return updateSubcontractor(id, payload);
    },
    onSuccess: async () => {
      setEditing(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignProjectId) throw new Error('Project required');
      return assignSubcontractorProject(id, {
        projectId: assignProjectId,
        contractValue: assignContractValue.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setAssignProjectId('');
      setAssignContractValue('');
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
    },
    onError: (error) => {
      setAssignError(
        error instanceof ApiError ? error.message : 'Zuordnung fehlgeschlagen',
      );
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (projectId: string) =>
      unassignSubcontractorProject(id, projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
    },
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <EmptyState
        title="Nachunternehmer konnte nicht geladen werden"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Unerwarteter Fehler'
        }
        actionLabel="Zurück zu Nachunternehmern"
        onAction={() => navigate('/subcontractors')}
      />
    );
  }

  const row = query.data;
  const address = [
    row.street,
    [row.postalCode, row.city].filter(Boolean).join(' '),
    row.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <PageHeader
        title={row.companyName}
        description={`${SUBCONTRACTOR_TRADE_LABELS[row.trade]} · Nachunternehmer-Details`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/subcontractors">
              <Button variant="secondary">Alle Nachunternehmer</Button>
            </Link>
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  setFormError(null);
                }}
              >
                {editing ? 'Bearbeitung schließen' : 'Bearbeiten'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Rechnungen gesamt"
          value={formatCurrency(row.totals.totalPurchases)}
        />
        <Metric
          label="Bezahlt"
          value={formatCurrency(row.totals.paidAmount)}
        />
        <Metric
          label="Offen"
          value={formatCurrency(row.totals.outstandingBalance)}
        />
        <Metric
          label="Zugewiesener Vertragswert"
          value={formatCurrency(
            row.totals.assignedContractValue ?? row.contractValue,
          )}
        />
      </div>

      {editing && canWrite && form ? (
        <Card className="mb-6" title="Nachunternehmer bearbeiten">
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
                setForm((prev) =>
                  prev ? { ...prev, companyName: e.target.value } : prev,
                )
              }
            />
            <Select
              label="Gewerk"
              name="trade"
              required
              value={form.trade}
              options={tradeOptions}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, trade: e.target.value as SubcontractorTrade }
                    : prev,
                )
              }
            />
            <Input
              label="Ansprechpartner"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contactPerson: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Vertragswert"
              name="contractValue"
              value={form.contractValue ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contractValue: e.target.value } : prev,
                )
              }
            />
            <Input
              label="E-Mail"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, email: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Telefon"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, phone: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Straße"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, street: e.target.value } : prev,
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="PLZ"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, postalCode: e.target.value } : prev,
                  )
                }
              />
              <Input
                label="Stadt"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, city: e.target.value } : prev,
                  )
                }
              />
            </div>
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
                onClick={() => setEditing(false)}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Kontaktdaten">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Gewerk</dt>
              <dd className="font-medium">
                {SUBCONTRACTOR_TRADE_LABELS[row.trade]}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Ansprechpartner</dt>
              <dd>{row.contactPerson ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">E-Mail</dt>
              <dd>{row.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Telefon</dt>
              <dd>{row.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Adresse</dt>
              <dd>{address || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Vertrag">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Rahmenvertragswert</dt>
              <dd className="font-medium">
                {formatCurrency(row.contractValue)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">USt-IdNr.</dt>
              <dd>{row.vatId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Steuernummer</dt>
              <dd>{row.taxNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Notizen</dt>
              <dd className="whitespace-pre-wrap">{row.notes ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Zugewiesene Projekte">
          {canWrite ? (
            <form
              className="mb-4 grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
            >
              <Select
                label="Projekt"
                name="projectId"
                required
                value={assignProjectId}
                placeholder="Projekt wählen"
                options={projectOptions}
                onChange={(e) => setAssignProjectId(e.target.value)}
              />
              <Input
                label="Vertragswert (optional)"
                name="assignContractValue"
                value={assignContractValue}
                onChange={(e) => setAssignContractValue(e.target.value)}
              />
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={assignMutation.isPending || !assignProjectId}
                >
                  Zuordnen
                </Button>
              </div>
              {assignError ? (
                <p className="md:col-span-3 text-sm text-[var(--color-danger)]">
                  {assignError}
                </p>
              ) : null}
            </form>
          ) : null}

          {row.projects.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Noch keine Projekte zugeordnet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Projekt</th>
                    <th className="px-3 py-2 font-medium">Vertragswert</th>
                    <th className="px-3 py-2 font-medium">Notizen</th>
                    {canWrite ? (
                      <th className="px-3 py-2 font-medium">Aktionen</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {row.projects.map((link) => (
                    <tr key={link.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/projects/${link.project.id}`}
                        >
                          {link.project.projectNumber} · {link.project.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(link.contractValue)}
                      </td>
                      <td className="px-3 py-3">{link.notes ?? '—'}</td>
                      {canWrite ? (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Zuordnung zu „${link.project.projectNumber}“ entfernen?`,
                                )
                              ) {
                                unassignMutation.mutate(link.project.id);
                              }
                            }}
                          >
                            Entfernen
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Rechnungen">
          {row.invoices.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Keine Rechnungen zugeordnet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nummer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Brutto</th>
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  </tr>
                </thead>
                <tbody>
                  {row.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          className="text-[var(--color-brand)] hover:underline"
                          to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(invoice.issueDate)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(invoice.grossAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {invoice.project ? (
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
                            to={`/projects/${invoice.project.id}`}
                          >
                            {invoice.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
