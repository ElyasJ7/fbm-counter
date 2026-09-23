import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  roleHasPermission,
  type InvoiceStatus,
  type InvoiceType,
  type SupportedCurrency,
} from '@fbm/shared';
import {
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '../components/finance/StatusBadges';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import {
  DataTable,
  dataTableHeadClassName,
  dataTableRowClassName,
  dataTableTdClassName,
  dataTableThClassName,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError, apiDownload } from '../lib/api';
import { formatDateDe, netAmountFieldLabel } from '../lib/format';
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
    throw new Error('PDF download failed');
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
  currency: undefined,
};

type InvoicesPageProps = {
  embeddedProjectId?: string;
  compact?: boolean;
  currency?: string;
};

export function InvoicesPage({
  embeddedProjectId,
  compact = false,
  currency,
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
  const [type, setType] = useState<InvoiceType | ''>(
    () => (searchParams.get('type') as InvoiceType | null) ?? '',
  );
  const [status, setStatus] = useState<InvoiceStatus | ''>(
    () => (searchParams.get('status') as InvoiceStatus | null) ?? '',
  );
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InvoiceInput>({
    ...emptyForm,
    projectId: projectFilter,
    currency: currency || undefined,
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
        currency: form.currency || currency || undefined,
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
            description: form.notes?.trim() || 'Line item 1',
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
      setForm({
                    ...emptyForm,
                    projectId: projectFilter,
                    currency: currency || undefined,
                  });
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
        <FilterBar className="mb-4">
          <Input
            label="Search"
            name="search"
            value={search}
            placeholder="Number, note…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Type"
            name="type"
            value={type}
            placeholder="All types"
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
            placeholder="All statuses"
            options={statusOptions}
            onChange={(e) => {
              setStatus(e.target.value as InvoiceStatus | '');
              setPage(1);
            }}
          />
        </FilterBar>
      ) : null}

      {showForm && canWrite ? (
        <Card className="mb-6" title="New invoice">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Select
              label="Type"
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
            <Select
              label="Currency"
              name="currency"
              value={form.currency ?? currency ?? ''}
              placeholder="Project / company default"
              options={SUPPORTED_CURRENCIES.map((code) => ({
                value: code,
                label: CURRENCY_LABELS[code as SupportedCurrency],
              }))}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  currency: e.target.value || undefined,
                }))
              }
            />
            <Input
              label={netAmountFieldLabel(form.currency ?? currency)}
              name="netAmount"
              required
              value={form.netAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, netAmount: e.target.value }))
              }
            />
            <Input
              label="VAT (%)"
              name="taxRate"
              value={form.taxRate ?? '19'}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxRate: e.target.value }))
              }
            />
            <Input
              label="Invoice Date"
              name="issueDate"
              type="date"
              required
              value={form.issueDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, issueDate: e.target.value }))
              }
            />
            <Input
              label="Due Date"
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
                label="Project"
                name="projectId"
                value={form.projectId ?? ''}
                placeholder="No project"
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
                label="Customer"
                name="customerId"
                value={form.customerId ?? ''}
                placeholder="Select customer"
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
                label="Supplier"
                name="supplierId"
                value={form.supplierId ?? ''}
                placeholder="Select supplier"
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
              label="Note / Line item description"
              name="notes"
              className="md:col-span-2"
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
            {formError ? (
              <Alert tone="danger" className="md:col-span-2">
                {formError}
              </Alert>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
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
        <ErrorState
          title="Could not load invoices"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create customer or supplier invoices to track receivables and payables."
          actionLabel={canWrite ? 'New invoice' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm({
                    ...emptyForm,
                    projectId: projectFilter,
                    currency: currency || undefined,
                  });
                }
              : undefined
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <DataTable
          footer={
            <>
              <span>
                Page {query.data.meta.page} of {query.data.meta.totalPages} (
                {query.data.meta.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= query.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          }
        >
          <table className="min-w-full text-left text-sm">
            <thead className={dataTableHeadClassName()}>
              <tr>
                <th className={dataTableThClassName()}>Number</th>
                <th className={dataTableThClassName()}>Type</th>
                <th className={dataTableThClassName()}>Party</th>
                {!projectFilter ? (
                  <th className={dataTableThClassName()}>Project</th>
                ) : null}
                <th className={dataTableThClassName()}>Status</th>
                <th className={dataTableThClassName('right')}>Gross</th>
                <th className={dataTableThClassName('right')}>Paid</th>
                <th className={dataTableThClassName()}>Due</th>
                <th className={dataTableThClassName()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((invoice) => {
                const party =
                  invoice.type === 'CUSTOMER'
                    ? invoice.customer?.companyName
                    : invoice.supplier?.companyName;
                return (
                  <tr key={invoice.id} className={dataTableRowClassName()}>
                    <td className={`${dataTableTdClassName()} font-medium`}>
                      {invoice.invoiceNumber}
                    </td>
                    <td className={dataTableTdClassName()}>
                      <InvoiceTypeBadge type={invoice.type} />
                    </td>
                    <td className={dataTableTdClassName()}>{party ?? '—'}</td>
                    {!projectFilter ? (
                      <td className={dataTableTdClassName()}>
                        {invoice.project ? (
                          <Link
                            className="text-brand hover:underline"
                            to={`/projects/${invoice.project.id}?tab=invoices`}
                          >
                            {invoice.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className={dataTableTdClassName()}>
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={invoice.grossAmount}
                        currency={invoice.currency}
                        size="sm"
                      />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={invoice.paidAmount}
                        currency={invoice.currency}
                        size="sm"
                      />
                    </td>
                    <td className={dataTableTdClassName()}>
                      {formatDateDe(invoice.dueDate)}
                    </td>
                    <td className={dataTableTdClassName()}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-brand hover:underline"
                          onClick={() => {
                            void downloadInvoicePdf(
                              invoice.id,
                              `${invoice.invoiceNumber}.pdf`,
                            ).catch((error) => {
                              window.alert(
                                error instanceof Error
                                  ? error.message
                                  : 'PDF download failed',
                              );
                            });
                          }}
                        >
                          PDF
                        </button>
                        <Link
                          className="text-brand hover:underline"
                          to={`/payments?invoiceId=${invoice.id}`}
                        >
                          Payments
                        </Link>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete invoice "${invoice.invoiceNumber}"?`,
                                )
                              ) {
                                deleteMutation.mutate(invoice.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Invoices for this Project
          </p>
          <div className="flex gap-2">
            <Link to={`/invoices?projectId=${projectFilter}`}>
              <Button variant="secondary" size="sm">
                View All
              </Button>
            </Link>
            {canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setForm({
                    ...emptyForm,
                    projectId: projectFilter,
                    currency: currency || undefined,
                  });
                  setShowForm(true);
                  setFormError(null);
                }}
              >
                New invoice
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
        title="Invoices"
        description="Customer and supplier invoices, balances, and PDFs."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm({
                    ...emptyForm,
                    projectId: projectFilter,
                    currency: currency || undefined,
                  });
                setShowForm(true);
                setFormError(null);
              }}
            >
              New invoice
            </Button>
          ) : null
        }
      />
      {content}
    </div>
  );
}
