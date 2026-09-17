import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PAYMENT_TYPE_LABELS,
  roleHasPermission,
  type InvoiceStatus,
} from '@fbm/shared';
import {
  InvoiceStatusBadge,
  PaymentTypeBadge,
} from '../components/finance/StatusBadges';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import { fetchDashboard } from '../services/dashboard';
import {
  fetchExpenses,
  fetchInvoices,
  fetchPayments,
} from '../services/finance';

const OPEN_STATUSES: InvoiceStatus[] = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
];

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function remaining(gross: string, paid: string) {
  return (Number(gross) - Number(paid)).toFixed(4);
}

export function FinancesPage() {
  const { user } = useAuth();
  const canRead = user
    ? roleHasPermission(user.role, 'finances:read')
    : false;

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'finances'],
    queryFn: fetchDashboard,
    enabled: canRead,
  });

  const openArQueries = useQueries({
    queries: OPEN_STATUSES.map((status) => ({
      queryKey: ['invoices', 'finances-ar', status],
      queryFn: () =>
        fetchInvoices({
          type: 'CUSTOMER',
          status,
          page: 1,
          pageSize: 20,
        }),
      enabled: canRead,
    })),
  });

  const openApQueries = useQueries({
    queries: OPEN_STATUSES.map((status) => ({
      queryKey: ['invoices', 'finances-ap', status],
      queryFn: () =>
        fetchInvoices({
          type: 'SUPPLIER',
          status,
          page: 1,
          pageSize: 20,
        }),
      enabled: canRead,
    })),
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', 'finances-open'],
    queryFn: () =>
      fetchExpenses({ page: 1, pageSize: 10, status: 'APPROVED' }),
    enabled: canRead,
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'finances-recent'],
    queryFn: () => fetchPayments({ page: 1, pageSize: 10 }),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Finanzen"
          description="Unternehmensweite Liquidität und offene Posten."
        />
        <EmptyState
          title="Kein Zugriff"
          description="Ihre Rolle darf Finanzübersichten nicht einsehen."
        />
      </div>
    );
  }

  const loading =
    dashboardQuery.isLoading ||
    openArQueries.some((q) => q.isLoading) ||
    openApQueries.some((q) => q.isLoading) ||
    paymentsQuery.isLoading;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (dashboardQuery.error) {
    return (
      <div>
        <PageHeader
          title="Finanzen"
          description="Unternehmensweite Liquidität und offene Posten."
        />
        <EmptyState
          title="Finanzen konnten nicht geladen werden"
          description={
            dashboardQuery.error instanceof ApiError
              ? dashboardQuery.error.message
              : 'Unerwarteter Fehler'
          }
        />
      </div>
    );
  }

  const kpis = dashboardQuery.data!.kpis;
  const currency = dashboardQuery.data!.currency;
  const openAr = openArQueries.flatMap((q) => q.data?.data ?? []);
  const openAp = openApQueries.flatMap((q) => q.data?.data ?? []);
  const openExpenses = (expensesQuery.data?.data ?? []).filter(
    (row) => Number(row.grossAmount) - Number(row.paidAmount) > 0,
  );
  const payments = paymentsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Finanzen"
        description="Liquidität, offene Forderungen/Verbindlichkeiten und letzte Zahlungen."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/invoices">
              <Button variant="secondary">Rechnungen</Button>
            </Link>
            <Link to="/expenses">
              <Button variant="secondary">Ausgaben</Button>
            </Link>
            <Link to="/payments">
              <Button variant="secondary">Zahlungen</Button>
            </Link>
            <Link to="/reports">
              <Button>Berichte</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Verfügbare Liquidität"
          value={formatCurrency(kpis.availableCash, currency)}
        />
        <KpiCard
          label="Offene Forderungen"
          value={formatCurrency(kpis.outstandingCustomerInvoices, currency)}
          hint="Kundenrechnungen"
        />
        <KpiCard
          label="Offene Verbindlichkeiten"
          value={formatCurrency(kpis.outstandingSupplierInvoices, currency)}
          hint="Lieferantenrechnungen"
        />
        <KpiCard
          label="Gesamterlös"
          value={formatCurrency(kpis.totalRevenue, currency)}
        />
        <KpiCard
          label="Gesamtausgaben"
          value={formatCurrency(kpis.totalExpenses, currency)}
        />
        <KpiCard
          label="Bruttogewinn"
          value={formatCurrency(kpis.grossProfit, currency)}
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card title="Offene Forderungen (AR)" description="Ausgangsrechnungen">
          {openAr.length === 0 ? (
            <EmptyState
              title="Keine offenen Forderungen"
              description="Alle Kundenrechnungen sind ausgeglichen oder noch Entwürfe."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Rechnung</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Fällig</th>
                    <th className="px-3 py-2 font-medium">Restbetrag</th>
                  </tr>
                </thead>
                <tbody>
                  {openAr.slice(0, 15).map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-3 py-3">
                        <Link
                          to="/invoices"
                          className="font-medium text-[var(--color-accent)] hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <div className="text-xs text-[var(--color-muted)]">
                          {invoice.customer?.companyName ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(invoice.dueDate)}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {formatCurrency(
                          remaining(invoice.grossAmount, invoice.paidAmount),
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Offene Verbindlichkeiten (AP)" description="Eingangsrechnungen">
          {openAp.length === 0 ? (
            <EmptyState
              title="Keine offenen Verbindlichkeiten"
              description="Keine offenen Lieferantenrechnungen."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Rechnung</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Fällig</th>
                    <th className="px-3 py-2 font-medium">Restbetrag</th>
                  </tr>
                </thead>
                <tbody>
                  {openAp.slice(0, 15).map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-3 py-3">
                        <Link
                          to="/invoices"
                          className="font-medium text-[var(--color-accent)] hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <div className="text-xs text-[var(--color-muted)]">
                          {invoice.supplier?.companyName ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(invoice.dueDate)}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {formatCurrency(
                          remaining(invoice.grossAmount, invoice.paidAmount),
                          currency,
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Freigegebene Ausgaben"
          description="Ausgaben mit Restbetrag"
        >
          {openExpenses.length === 0 ? (
            <EmptyState
              title="Keine offenen Ausgaben"
              description="Keine freigegebenen Ausgaben mit Restbetrag."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ausgabe</th>
                    <th className="px-3 py-2 font-medium">Fällig</th>
                    <th className="px-3 py-2 font-medium">Restbetrag</th>
                  </tr>
                </thead>
                <tbody>
                  {openExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{expense.expenseNumber}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {expense.description}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(expense.dueDate)}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {formatCurrency(
                          remaining(expense.grossAmount, expense.paidAmount),
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Letzte Zahlungen" description="Neueste Zahlungseinträge">
          {payments.length === 0 ? (
            <EmptyState
              title="Keine Zahlungen"
              description="Zahlungen erscheinen hier nach der Erfassung."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Zahlung</th>
                    <th className="px-3 py-2 font-medium">Typ</th>
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{payment.paymentNumber}</div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {payment.invoice.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <PaymentTypeBadge type={payment.type} />
                        <span className="sr-only">
                          {PAYMENT_TYPE_LABELS[payment.type]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {formatDateDe(payment.paymentDate)}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {formatCurrency(payment.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Offene Posten: Status SENT, OPEN, PARTIALLY_PAID, OVERDUE.
          </p>
    </div>
  );
}
