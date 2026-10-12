import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { roleHasPermission, type InvoiceStatus } from '@fbm/shared';
import { InvoiceStatusBadge } from '../components/finance/StatusBadges';
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
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonCard } from '../components/ui/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatDateDe } from '../lib/format';
import { fetchDashboard } from '../services/dashboard';
import { fetchExpenses, fetchInvoices } from '../services/finance';

const OPEN_STATUSES: InvoiceStatus[] = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
];

function remaining(gross: string, paid: string) {
  return (Number(gross) - Number(paid)).toFixed(4);
}

export function FinancesPage() {
  const { user } = useAuth();
  const canRead = user
    ? roleHasPermission(user.role, 'finances:read')
    : false;

  const dashboardQuery = useQuery({
    queryKey: [
      'dashboard',
      'finances',
      user?.preferredDisplayCurrency ?? 'company-default',
    ],
    queryFn: () =>
      fetchDashboard(user?.preferredDisplayCurrency ?? undefined),
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

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Finances"
          description="Company-wide cash position and open items."
        />
        <EmptyState
          title="No access"
          description="Your role cannot view the finance overview."
        />
      </div>
    );
  }

  const loading =
    dashboardQuery.isLoading ||
    openArQueries.some((q) => q.isLoading) ||
    openApQueries.some((q) => q.isLoading);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (dashboardQuery.error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Finances"
          description="Company-wide cash position and open items."
        />
        <EmptyState
          title="Could not load finances"
          description={
            dashboardQuery.error instanceof ApiError
              ? dashboardQuery.error.message
              : 'Unexpected error'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances"
        description="Liquidity, receivables, payables, and open items."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/invoices">
              <Button variant="secondary">Invoices</Button>
            </Link>
            <Link to="/expenses">
              <Button variant="secondary">Expenses</Button>
            </Link>
            <Link to="/reports">
              <Button>Reports</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Available cash"
          value={
            <CurrencyValue value={kpis.availableCash} currency={currency} size="lg" />
          }
          tone="info"
        />
        <StatCard
          label="Accounts receivable"
          value={
            <CurrencyValue
              value={kpis.outstandingCustomerInvoices}
              currency={currency}
              size="lg"
            />
          }
          hint="Customer invoices"
          tone="info"
        />
        <StatCard
          label="Accounts payable"
          value={
            <CurrencyValue
              value={kpis.outstandingSupplierInvoices}
              currency={currency}
              size="lg"
            />
          }
          hint="Supplier invoices"
          tone="warning"
        />
        <StatCard
          label="Cash received"
          value={
            <CurrencyValue value={kpis.totalRevenue} currency={currency} size="lg" />
          }
          tone="success"
        />
        <StatCard
          label="Actual costs"
          value={
            <CurrencyValue value={kpis.totalExpenses} currency={currency} size="lg" />
          }
          tone="warning"
        />
        <StatCard
          label="Gross profit"
          value={
            <CurrencyValue value={kpis.grossProfit} currency={currency} size="lg" />
          }
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Accounts receivable" description="Open customer invoices">
          {openAr.length === 0 ? (
            <EmptyState
              title="No open receivables"
              description="Customer invoices are settled or still drafts."
            />
          ) : (
            <DataTable className="border-0 shadow-none">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Invoice</th>
                    <th className={dataTableThClassName()}>Status</th>
                    <th className={dataTableThClassName()}>Due</th>
                    <th className={dataTableThClassName('right')}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {openAr.slice(0, 15).map((invoice) => (
                    <tr key={invoice.id} className={dataTableRowClassName()}>
                      <td className={dataTableTdClassName()}>
                        <Link
                          to="/invoices"
                          className="font-medium text-brand hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <div className="text-xs text-muted">
                          {invoice.customer?.companyName ?? '—'}
                        </div>
                      </td>
                      <td className={dataTableTdClassName()}>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {formatDateDe(invoice.dueDate)}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue
                          value={remaining(invoice.grossAmount, invoice.paidAmount)}
                          currency={currency}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Card>

        <Card title="Accounts payable" description="Open supplier invoices">
          {openAp.length === 0 ? (
            <EmptyState
              title="No open payables"
              description="No open supplier invoices."
            />
          ) : (
            <DataTable className="border-0 shadow-none">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Invoice</th>
                    <th className={dataTableThClassName()}>Status</th>
                    <th className={dataTableThClassName()}>Due</th>
                    <th className={dataTableThClassName('right')}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {openAp.slice(0, 15).map((invoice) => (
                    <tr key={invoice.id} className={dataTableRowClassName()}>
                      <td className={dataTableTdClassName()}>
                        <Link
                          to="/invoices"
                          className="font-medium text-brand hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <div className="text-xs text-muted">
                          {invoice.supplier?.companyName ?? '—'}
                        </div>
                      </td>
                      <td className={dataTableTdClassName()}>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {formatDateDe(invoice.dueDate)}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue
                          value={remaining(invoice.grossAmount, invoice.paidAmount)}
                          currency={currency}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Approved expenses" description="Expenses with remaining balance">
          {openExpenses.length === 0 ? (
            <EmptyState
              title="No open expenses"
              description="No approved expenses with a remaining balance."
            />
          ) : (
            <DataTable className="border-0 shadow-none">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Expense</th>
                    <th className={dataTableThClassName()}>Due</th>
                    <th className={dataTableThClassName('right')}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {openExpenses.map((expense) => (
                    <tr key={expense.id} className={dataTableRowClassName()}>
                      <td className={dataTableTdClassName()}>
                        <div className="font-medium">{expense.expenseNumber}</div>
                        <div className="text-xs text-muted">
                          {expense.description}
                        </div>
                      </td>
                      <td className={dataTableTdClassName()}>
                        {formatDateDe(expense.dueDate)}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue
                          value={remaining(expense.grossAmount, expense.paidAmount)}
                          currency={currency}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Card>

      </div>

      <p className="text-helper">
        Cost totals follow the invoice-wins policy (duplicate expense+invoice
        amounts are not double-counted). Open items use statuses SENT, OPEN,
        PARTIALLY_PAID, and OVERDUE.
      </p>
    </div>
  );
}
