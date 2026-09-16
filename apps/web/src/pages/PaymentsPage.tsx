import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  roleHasPermission,
  type PaymentMethod,
} from '@fbm/shared';
import {
  PaymentMethodBadge,
  PaymentTypeBadge,
} from '../components/finance/StatusBadges';
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
  createPayment,
  deletePayment,
  fetchInvoices,
  fetchPayments,
  type PaymentInput,
} from '../services/finance';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: PaymentInput = {
  invoiceId: '',
  amount: '',
  paymentDate: todayInput(),
  method: 'BANK_TRANSFER',
  reference: '',
  notes: '',
};

type PaymentsPageProps = {
  embeddedProjectId?: string;
  compact?: boolean;
};

export function PaymentsPage({
  embeddedProjectId,
  compact = false,
}: PaymentsPageProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canWrite = user
    ? roleHasPermission(user.role, 'payments:write')
    : false;

  const projectFilter =
    embeddedProjectId ?? searchParams.get('projectId') ?? '';
  const invoiceFilter = searchParams.get('invoiceId') ?? '';
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(Boolean(invoiceFilter));
  const [form, setForm] = useState<PaymentInput>({
    ...emptyForm,
    invoiceId: invoiceFilter,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['payments', page, projectFilter, invoiceFilter],
    queryFn: () =>
      fetchPayments({
        page,
        pageSize: compact ? 10 : 20,
        projectId: projectFilter || undefined,
        invoiceId: invoiceFilter || undefined,
      }),
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'payment-form', projectFilter],
    queryFn: () =>
      fetchInvoices({
        page: 1,
        pageSize: 100,
        projectId: projectFilter || undefined,
      }),
    enabled: showForm,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: PaymentInput = {
        invoiceId: form.invoiceId,
        amount: form.amount.trim(),
        paymentDate: form.paymentDate,
        method: form.method || 'BANK_TRANSFER',
        reference: form.reference?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        projectId: projectFilter || undefined,
      };
      return createPayment(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm({ ...emptyForm, invoiceId: invoiceFilter });
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
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
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const methodOptions = useMemo(
    () =>
      PAYMENT_METHODS.map((value) => ({
        value,
        label: PAYMENT_METHOD_LABELS[value],
      })),
    [],
  );

  const content = (
    <>
      {showForm && canWrite ? (
        <Card className="mb-6" title="Neue Zahlung">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Select
              label="Rechnung"
              name="invoiceId"
              required
              value={form.invoiceId}
              placeholder="Rechnung wählen"
              options={(invoicesQuery.data?.data ?? []).map((inv) => ({
                value: inv.id,
                label: `${inv.invoiceNumber} · ${formatCurrency(inv.grossAmount)} (${formatCurrency(inv.paidAmount)} bezahlt)`,
              }))}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, invoiceId: e.target.value }))
              }
            />
            <Input
              label="Betrag (€)"
              name="amount"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
            <Input
              label="Zahlungsdatum"
              name="paymentDate"
              type="date"
              required
              value={form.paymentDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentDate: e.target.value }))
              }
            />
            <Select
              label="Zahlungsart"
              name="method"
              value={form.method ?? 'BANK_TRANSFER'}
              options={methodOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  method: e.target.value as PaymentMethod,
                }))
              }
            />
            <Input
              label="Referenz"
              name="reference"
              value={form.reference ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reference: e.target.value }))
              }
            />
            <Input
              label="Notiz"
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
          title="Zahlungen konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Keine Zahlungen"
          description="Erfassen Sie Zahlungseingänge und -ausgänge gegen Rechnungen."
          actionLabel={canWrite ? 'Neue Zahlung' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm({ ...emptyForm, invoiceId: invoiceFilter });
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
                  <th className="px-3 py-2 font-medium">Rechnung</th>
                  {!projectFilter ? (
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Typ</th>
                  <th className="px-3 py-2 font-medium">Art</th>
                  <th className="px-3 py-2 font-medium">Betrag</th>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        className="text-[var(--color-brand)] hover:underline"
                        to={`/invoices?search=${encodeURIComponent(payment.invoice.invoiceNumber)}`}
                      >
                        {payment.invoice.invoiceNumber}
                      </Link>
                    </td>
                    {!projectFilter ? (
                      <td className="px-3 py-3">
                        {payment.project ? (
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
                            to={`/projects/${payment.project.id}?tab=payments`}
                          >
                            {payment.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <PaymentTypeBadge type={payment.type} />
                    </td>
                    <td className="px-3 py-3">
                      <PaymentMethodBadge method={payment.method} />
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-3 py-3">
                      {formatDateDe(payment.paymentDate)}
                    </td>
                    <td className="px-3 py-3">
                      {canWrite ? (
                        <button
                          type="button"
                          className="text-[var(--color-danger)] hover:underline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Zahlung „${payment.paymentNumber}“ löschen?`,
                              )
                            ) {
                              deleteMutation.mutate(payment.id);
                            }
                          }}
                        >
                          Löschen
                        </button>
                      ) : null}
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
    </>
  );

  if (compact) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-muted)]">
            Zahlungen für dieses Projekt
          </p>
          <div className="flex gap-2">
            <Link to={`/payments?projectId=${projectFilter}`}>
              <Button variant="secondary" size="sm">
                Alle anzeigen
              </Button>
            </Link>
            {canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setForm(emptyForm);
                  setShowForm(true);
                  setFormError(null);
                }}
              >
                Neue Zahlung
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
        title="Zahlungen"
        description="Zahlungen gegen Rechnungen erfassen und abstimmen."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm({ ...emptyForm, invoiceId: invoiceFilter });
                setShowForm(true);
                setFormError(null);
              }}
            >
              Neue Zahlung
            </Button>
          ) : null
        }
      />
      {content}
    </div>
  );
}
