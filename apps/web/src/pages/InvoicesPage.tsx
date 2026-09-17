import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  roleHasPermission,
  type InvoiceStatus,
  type InvoiceType,
} from '@fbm/shared';
import {
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '../components/finance/StatusBadges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError, apiDownload } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import {
  createInvoice,
  deleteInvoice,
  fetchInvoices,
  fetchSuppliers,
  invoicePdfPath,
  type InvoiceInput,
} from '../services/finance';
import { fetchCustomers, fetchProjects } from '../services/projects';

async function downloadInvoicePdf(id: string, fallbackName: string) {
  const response = await apiDownload(invoicePdfPath(id));
  if (!response.ok) {
    throw new Error('PDF-Download fehlgeschlagen');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(
    disposition,
  );
  const filename = decodeURIComponent(
    match?.[1] ?? match?.[2] ?? fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysInput(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const emptyForm: InvoiceInput = {
  type: 'CUSTOMER',
  issueDate: todayInput(),
  dueDate: plusDaysInput(30),
  netAmount: '',
  taxRate: '19',
  status: 'DRAFT',
  projectId: '',
  customerId: '',
  supplierId: '',
  notes: '',
};

type InvoicesPageProps = {
  embeddedProjectId?: string;
  compact?: boolean;
};

export function InvoicesPage({
  embeddedProjectId,
  compact = false,
}: InvoicesPageProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canWrite = user
    ? roleHasPermission(user.role, 'invoices:write')
    : false;

  const projectFilter =
    embeddedProjectId ?? searchParams.get('projectId') ?? '';
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [type, setType] = useState<InvoiceType | ''>('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InvoiceInput>({
    ...emptyForm,
    projectId: projectFilter,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['invoices', page, search, type, status, projectFilter],
    queryFn: () =>
      fetchInvoices({
        page,
        pageSize: compact ? 10 : 20,
        search,
        type,
        status,
        projectId: projectFilter || undefined,
      }),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'invoice-form'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: showForm && !embeddedProjectId,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'invoice-form'],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 100 }),
    enabled: showForm && form.type === 'CUSTOMER',
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'invoice-form'],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 100 }),
    enabled: showForm && form.type === 'SUPPLIER',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: InvoiceInput = {
        type: form.type,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        netAmount: form.netAmount.trim(),
        taxRate: form.taxRate?.trim() || '19',
        status: form.status || 'DRAFT',
        projectId: form.projectId || projectFilter || undefined,
        customerId:
          form.type === 'CUSTOMER'
            ? form.customerId || undefined
            : undefined,
        supplierId:
          form.type === 'SUPPLIER'
            ? form.supplierId || undefined
            : undefined,
        paymentTerms: form.paymentTerms?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        items: [
          {
            description: form.notes?.trim() || 'Position 1',
            quantity: '1',
            unitPrice: form.netAmount.trim(),
            netAmount: form.netAmount.trim(),
          },
        ],
      };
      return createInvoice(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm({ ...emptyForm, projectId: projectFilter });
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (projectFilter) {
        await queryClient.invalidateQueries({
          queryKey: ['project', projectFilter],
        });
      }
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const typeOptions = useMemo(
    () =>
      INVOICE_TYPES.map((value) => ({
        value,
        label: INVOICE_TYPE_LABELS[value],
      })),
    [],
  );

  const statusOptions = useMemo(
    () =>
      INVOICE_STATUSES.map((value) => ({
        value,
        label: INVOICE_STATUS_LABELS[value],
      })),
    [],
  );

  const content = (
    <>
      {!compact ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Input
            label="Suche"
            name="search"
            value={search}
            placeholder="Nummer, Notiz…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Typ"
            name="type"
            value={type}
            placeholder="Alle Typen"
            options={typeOptions}
            onChange={(e) => {
              setType(e.target.value as InvoiceType | '');
              setPage(1);
            }}
          />
          <Select
            label="Status"
            name="status"
            value={status}
            placeholder="Alle Status"
            options={statusOptions}
            onChange={(e) => {
              setStatus(e.target.value as InvoiceStatus | '');
              setPage(1);
            }}
          />
        </div>
      ) : null}

      {showForm && canWrite ? (
        <Card className="mb-6" title="Neue Rechnung">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Select
              label="Typ"
              name="type"
              value={form.type}
              options={typeOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value as InvoiceType,
                  customerId: '',
                  supplierId: '',
                }))
              }
            />
            <Select
              label="Status"
              name="status"
              value={form.status ?? 'DRAFT'}
              options={statusOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as InvoiceStatus,
                }))
              }
            />
            <Input
              label="Nettobetrag (€)"
              name="netAmount"
              required
              value={form.netAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, netAmount: e.target.value }))
              }
            />
            <Input
              label="MwSt. %"
              name="taxRate"
              value={form.taxRate ?? '19'}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxRate: e.target.value }))
              }
            />
            <Input
              label="Rechnungsdatum"
              name="issueDate"
              type="date"
              required
              value={form.issueDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, issueDate: e.target.value }))
              }
            />
            <Input
              label="Fällig am"
              name="dueDate"
              type="date"
              required
              value={form.dueDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
            />
            {!embeddedProjectId ? (
              <Select
                label="Projekt"
                name="projectId"
                value={form.projectId ?? ''}
                placeholder="Kein Projekt"
                options={(projectsQuery.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.projectNumber} · ${p.name}`,
                }))}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, projectId: e.target.value }))
                }
              />
            ) : null}
            {form.type === 'CUSTOMER' ? (
              <Select
                label="Kunde"
                name="customerId"
                value={form.customerId ?? ''}
                placeholder="Kunde wählen"
                options={(customersQuery.data?.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.companyName,
                }))}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, customerId: e.target.value }))
                }
              />
            ) : (
              <Select
                label="Lieferant"
                name="supplierId"
                value={form.supplierId ?? ''}
                placeholder="Lieferant wählen"
                options={(suppliersQuery.data?.data ?? []).map((s) => ({
                  value: s.id,
                  label: s.companyName,
                }))}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, supplierId: e.target.value }))
                }
              />
            )}
            <Input
              label="Notiz / Positionsbeschreibung"
              name="notes"
              className="md:col-span-2"
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
          title="Rechnungen konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Keine Rechnungen"
          description="Erstellen Sie Ausgangs- oder Eingangsrechnungen."
          actionLabel={canWrite ? 'Neue Rechnung' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm({ ...emptyForm, projectId: projectFilter });
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
                  <th className="px-3 py-2 font-medium">Nummer</th>
                  <th className="px-3 py-2 font-medium">Typ</th>
                  <th className="px-3 py-2 font-medium">Partei</th>
                  {!projectFilter ? (
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Brutto</th>
                  <th className="px-3 py-2 font-medium">Bezahlt</th>
                  <th className="px-3 py-2 font-medium">Fällig</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((invoice) => {
                  const party =
                    invoice.type === 'CUSTOMER'
                      ? invoice.customer?.companyName
                      : invoice.supplier?.companyName;
                  return (
                    <tr key={invoice.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceTypeBadge type={invoice.type} />
                      </td>
                      <td className="px-3 py-3">{party ?? '—'}</td>
                      {!projectFilter ? (
                        <td className="px-3 py-3">
                          {invoice.project ? (
                            <Link
                              className="text-[var(--color-brand)] hover:underline"
                              to={`/projects/${invoice.project.id}?tab=invoices`}
                            >
                              {invoice.project.projectNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(invoice.grossAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCurrency(invoice.paidAmount)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(invoice.dueDate)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-[var(--color-brand)] hover:underline"
                            onClick={() => {
                              void downloadInvoicePdf(
                                invoice.id,
                                `${invoice.invoiceNumber}.pdf`,
                              ).catch((error) => {
                                window.alert(
                                  error instanceof Error
                                    ? error.message
                                    : 'PDF-Download fehlgeschlagen',
                                );
                              });
                            }}
                          >
                            PDF
                          </button>
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
                            to={`/payments?invoiceId=${invoice.id}`}
                          >
                            Zahlungen
                          </Link>
                          {canWrite ? (
                            <button
                              type="button"
                              className="text-[var(--color-danger)] hover:underline"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Rechnung „${invoice.invoiceNumber}“ löschen?`,
                                  )
                                ) {
                                  deleteMutation.mutate(invoice.id);
                                }
                              }}
                            >
                              Löschen
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </>
  );

  if (compact) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-muted)]">
            Rechnungen für dieses Projekt
          </p>
          <div className="flex gap-2">
            <Link to={`/invoices?projectId=${projectFilter}`}>
              <Button variant="secondary" size="sm">
                Alle anzeigen
              </Button>
            </Link>
            {canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setForm({ ...emptyForm, projectId: projectFilter });
                  setShowForm(true);
                  setFormError(null);
                }}
              >
                Neue Rechnung
              </Button>
            ) : null}
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Rechnungen"
        description="Ausgangs- und Eingangsrechnungen mit MwSt."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm({ ...emptyForm, projectId: projectFilter });
                setShowForm(true);
                setFormError(null);
              }}
            >
              Neue Rechnung
            </Button>
          ) : null
        }
      />
      {content}
    </div>
  );
}
