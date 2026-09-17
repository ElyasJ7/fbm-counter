import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  FileText,
  Landmark,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  PROJECT_STATUS_LABELS,
  roleHasPermission,
  type InvoiceDto,
  type InvoiceStatus,
  type ProjectStatus,
} from '@fbm/shared';
import { money } from '@fbm/financial-core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { DashboardKpiCard } from '../components/dashboard/DashboardKpiCard';
import { DashboardSection } from '../components/dashboard/DashboardSection';
import { InvoiceStatusBadge } from '../components/finance/StatusBadges';
import { Button } from '../components/ui/Button';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import { cn } from '../lib/cn';
import { fetchAuditLogs } from '../services/audit';
import { fetchDashboard } from '../services/dashboard';
import { fetchInvoices } from '../services/finance';

const CHART = {
  inflow: '#0f4c5c',
  outflow: '#c2410c',
  grid: '#e2e8f0',
  tick: '#64748b',
};

const OUTSTANDING_STATUSES = new Set<InvoiceStatus>([
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
]);

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function moneyTick(value: number, currency: string) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value, currency);
}

function invoiceOutstanding(invoice: InvoiceDto) {
  return money(invoice.grossAmount).minus(invoice.paidAmount);
}

function sortOutstanding(a: InvoiceDto, b: InvoiceDto) {
  const aOverdue = a.status === 'OVERDUE' ? 0 : 1;
  const bOverdue = b.status === 'OVERDUE' ? 0 : 1;
  if (aOverdue !== bOverdue) return aOverdue - bOverdue;
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

function budgetTone(utilization: number): 'brand' | 'warning' | 'danger' {
  if (utilization >= 100) return 'danger';
  if (utilization >= 85) return 'warning';
  return 'brand';
}

function budgetLabel(utilization: number) {
  if (utilization >= 100) return 'Over budget';
  if (utilization >= 85) return 'Approaching budget';
  return 'Within budget';
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; name?: string; color?: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const inflow = Number(payload.find((p) => p.dataKey === 'inflow')?.value ?? 0);
  const outflow = Number(payload.find((p) => p.dataKey === 'outflow')?.value ?? 0);
  const net = inflow - outflow;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-panel px-3 py-2 text-xs shadow-[var(--shadow-sm)]">
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <dl className="space-y-1">
        <div className="flex justify-between gap-6">
          <dt className="text-muted">Cash received</dt>
          <dd className="tabular-money font-medium text-ink">
            {formatCurrency(inflow, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted">Cash paid</dt>
          <dd className="tabular-money font-medium text-ink">
            {formatCurrency(outflow, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-border pt-1">
          <dt className="font-medium text-ink">Net cash flow</dt>
          <dd
            className={cn(
              'tabular-money font-semibold',
              net < 0 ? 'text-danger' : 'text-ink',
            )}
          >
            {formatCurrency(net, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div>
        <Skeleton className="mb-2 h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={`p-${i}`} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={`s-${i}`} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonCard className="h-80 xl:col-span-2" />
        <SkeletonCard className="h-80" />
      </div>
      <SkeletonCard className="h-64" />
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canReadInvoices = user
    ? roleHasPermission(user.role, 'invoices:read')
    : false;
  const canWriteProjects = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;
  const canWriteInvoices = user
    ? roleHasPermission(user.role, 'invoices:write')
    : false;
  const canWritePayments = user
    ? roleHasPermission(user.role, 'payments:write')
    : false;
  const canReadAudit = user
    ? roleHasPermission(user.role, 'audit:read')
    : false;

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  const customerInvoicesQuery = useQuery({
    queryKey: ['dashboard', 'invoices', 'customer'],
    queryFn: () =>
      fetchInvoices({ type: 'CUSTOMER', page: 1, pageSize: 40 }),
    enabled: canReadInvoices && query.isSuccess,
  });

  const supplierInvoicesQuery = useQuery({
    queryKey: ['dashboard', 'invoices', 'supplier'],
    queryFn: () =>
      fetchInvoices({ type: 'SUPPLIER', page: 1, pageSize: 40 }),
    enabled: canReadInvoices && query.isSuccess,
  });

  const activityQuery = useQuery({
    queryKey: ['dashboard', 'audit-recent'],
    queryFn: () => fetchAuditLogs({ page: 1, pageSize: 8 }),
    enabled: canReadAudit && query.isSuccess,
  });

  const outstandingCustomer = useMemo(() => {
    const rows = customerInvoicesQuery.data?.data ?? [];
    return rows
      .filter((inv) => OUTSTANDING_STATUSES.has(inv.status))
      .filter((inv) => invoiceOutstanding(inv).gt(0))
      .sort(sortOutstanding)
      .slice(0, 6);
  }, [customerInvoicesQuery.data]);

  const outstandingSupplier = useMemo(() => {
    const rows = supplierInvoicesQuery.data?.data ?? [];
    return rows
      .filter((inv) => OUTSTANDING_STATUSES.has(inv.status))
      .filter((inv) => invoiceOutstanding(inv).gt(0))
      .sort(sortOutstanding)
      .slice(0, 6);
  }, [supplierInvoicesQuery.data]);

  if (query.isLoading) {
    return <DashboardSkeleton />;
  }

  if (query.error || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          description="Company financial overview."
        />
        <ErrorState
          title="Could not load dashboard"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error. Try refreshing the page.'
          }
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      </div>
    );
  }

  const data = query.data;
  const { kpis, charts, comparisons, currency, generatedAt } = data;
  const asOf = formatDateDe(generatedAt);

  const cashFlowData = charts.monthlyCashFlow.map((row) => ({
    month: formatMonthLabel(row.month),
    monthKey: row.month,
    inflow: money(row.inflow).toNumber(),
    outflow: money(row.outflow).toNumber(),
    net: money(row.net).toNumber(),
  }));
  const hasCashActivity = cashFlowData.some(
    (row) => row.inflow !== 0 || row.outflow !== 0,
  );

  const projectRows = charts.projectProfitability;
  const budgetRows = [...projectRows]
    .map((row) => {
      const budget = money(row.currentBudget);
      const actual = money(row.costs);
      const committed = money(row.committedCosts);
      const remaining = budget.minus(actual).minus(committed);
      const utilization = budget.isZero()
        ? null
        : actual
            .plus(committed)
            .div(budget)
            .mul(100)
            .toDecimalPlaces(1)
            .toNumber();
      return { ...row, budget, actual, committed, remaining, utilization };
    })
    .filter((row) => row.utilization !== null)
    .sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0))
    .slice(0, 6);

  const projectStatus = (charts.projectStatusDistribution ?? []).map((row) => ({
    status: row.status as ProjectStatus,
    label: PROJECT_STATUS_LABELS[row.status as ProjectStatus] ?? row.status,
    count: row.count,
  }));
  const projectStatusTotal =
    projectStatus.reduce((sum, row) => sum + row.count, 0) || 1;

  const attentionItems: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    to: string;
    tone: 'danger' | 'warning';
  }> = [];

  for (const inv of outstandingCustomer.filter((i) => i.status === 'OVERDUE').slice(0, 3)) {
    attentionItems.push({
      id: `ar-${inv.id}`,
      type: 'Overdue receivable',
      title: inv.invoiceNumber,
      detail: `${inv.customer?.companyName ?? 'Customer'} · ${formatCurrency(invoiceOutstanding(inv).toFixed(2), currency)} due ${formatDateDe(inv.dueDate)}`,
      to: `/invoices?type=CUSTOMER&status=OVERDUE`,
      tone: 'danger',
    });
  }
  for (const inv of outstandingSupplier.filter((i) => i.status === 'OVERDUE').slice(0, 3)) {
    attentionItems.push({
      id: `ap-${inv.id}`,
      type: 'Overdue payable',
      title: inv.invoiceNumber,
      detail: `${inv.supplier?.companyName ?? 'Supplier'} · ${formatCurrency(invoiceOutstanding(inv).toFixed(2), currency)} due ${formatDateDe(inv.dueDate)}`,
      to: `/invoices?type=SUPPLIER&status=OVERDUE`,
      tone: 'danger',
    });
  }
  for (const row of budgetRows.filter((r) => (r.utilization ?? 0) >= 100).slice(0, 3)) {
    attentionItems.push({
      id: `budget-${row.projectId}`,
      type: 'Over budget',
      title: row.name,
      detail: `${row.projectNumber} · ${Math.round(row.utilization ?? 0)}% of current budget used`,
      to: `/projects/${row.projectId}?tab=budget`,
      tone: 'danger',
    });
  }
  for (const row of budgetRows.filter(
    (r) => (r.utilization ?? 0) >= 85 && (r.utilization ?? 0) < 100,
  ).slice(0, 2)) {
    attentionItems.push({
      id: `warn-${row.projectId}`,
      type: 'Approaching budget',
      title: row.name,
      detail: `${row.projectNumber} · ${Math.round(row.utilization ?? 0)}% utilized`,
      to: `/projects/${row.projectId}?tab=budget`,
      tone: 'warning',
    });
  }

  const overdueInvoiceCount =
    charts.invoiceStatusDistribution.find((r) => r.status === 'OVERDUE')
      ?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName}. Cash, costs, receivables, and project health.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-caption w-full sm:mr-2 sm:w-auto">As of {asOf}</p>
            {canWriteProjects ? (
              <Link to="/projects/new">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  New project
                </Button>
              </Link>
            ) : null}
            {canWriteInvoices ? (
              <Link to="/invoices">
                <Button size="sm" variant="secondary">
                  New invoice
                </Button>
              </Link>
            ) : null}
            {canWritePayments ? (
              <Link to="/payments">
                <Button size="sm" variant="secondary">
                  Record payment
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {!comparisons.previousPeriodAvailable && comparisons.note ? (
        <p className="text-helper -mt-3">{comparisons.note}</p>
      ) : null}

      {/* Primary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          label="Cash received"
          value={
            <CurrencyValue value={kpis.totalRevenue} currency={currency} size="lg" />
          }
          hint="Customer invoice payments received"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          tone="brand"
          to={canReadInvoices ? '/payments' : undefined}
        />
        <DashboardKpiCard
          label="Actual costs"
          value={
            <CurrencyValue value={kpis.totalExpenses} currency={currency} size="lg" />
          }
          hint="Paid costs (invoice-wins policy)"
          icon={<Receipt className="h-4 w-4" />}
          tone="default"
        />
        <DashboardKpiCard
          label="Accounts receivable"
          value={
            <CurrencyValue
              value={kpis.outstandingCustomerInvoices}
              currency={currency}
              size="lg"
            />
          }
          hint={
            overdueInvoiceCount > 0
              ? `${overdueInvoiceCount} overdue invoice${overdueInvoiceCount === 1 ? '' : 's'} in ledger`
              : 'Open customer invoices'
          }
          icon={<Wallet className="h-4 w-4" />}
          tone="info"
          to={canReadInvoices ? '/invoices?type=CUSTOMER' : undefined}
        />
        <DashboardKpiCard
          label="Accounts payable"
          value={
            <CurrencyValue
              value={kpis.outstandingSupplierInvoices}
              currency={currency}
              size="lg"
            />
          }
          hint="Open supplier invoices"
          icon={<Landmark className="h-4 w-4" />}
          to={canReadInvoices ? '/invoices?type=SUPPLIER' : undefined}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          emphasis="secondary"
          label="Active projects"
          value={String(kpis.activeProjects)}
          hint={`Contract value ${formatCurrency(kpis.totalProjectValue, currency)}`}
          icon={<Building2 className="h-4 w-4" />}
          tone="brand"
          to="/projects?status=ACTIVE"
        />
        <DashboardKpiCard
          emphasis="secondary"
          label="Current budget"
          value={
            <CurrencyValue value={kpis.totalBudget} currency={currency} size="md" />
          }
          hint={
            kpis.budgetUtilizationPercent !== null
              ? `${kpis.budgetUtilizationPercent.replace('.', ',')}% utilized (company)`
              : 'Sum of project current budgets'
          }
          icon={<FileText className="h-4 w-4" />}
        />
        <DashboardKpiCard
          emphasis="secondary"
          label="Project profit"
          value={
            <CurrencyValue
              value={kpis.grossProfit}
              currency={currency}
              size="md"
              tone={money(kpis.grossProfit).lt(0) ? 'danger' : 'default'}
            />
          }
          hint="Cash received − actual costs"
          icon={<TrendingUp className="h-4 w-4" />}
          tone={money(kpis.grossProfit).gte(0) ? 'success' : 'danger'}
        />
        <DashboardKpiCard
          emphasis="secondary"
          label="Available cash"
          value={
            <CurrencyValue value={kpis.availableCash} currency={currency} size="md" />
          }
          hint="All inflows − all outflows"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
      </div>

      {/* Cash flow + project status */}
      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardSection
          className="xl:col-span-2"
          title="Cash flow"
          description="Customer payments received vs outgoing cash (last 12 months)."
        >
          {!hasCashActivity ? (
            <EmptyState
              title="No cash activity yet"
              description="This chart fills in as customer and supplier payments are recorded."
              className="border-0 bg-background/50 py-12 shadow-none"
            />
          ) : (
            <div
              className="h-64 w-full sm:h-72"
              role="img"
              aria-label="Monthly cash received versus cash paid for the last 12 months"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cashFlowData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART.tick }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => moneyTick(Number(v), currency)}
                    width={48}
                  />
                  <Tooltip
                    content={<ChartTooltip currency={currency} />}
                    cursor={{ fill: 'rgb(15 23 42 / 0.04)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="inflow"
                    name="Cash received"
                    fill={CHART.inflow}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="outflow"
                    name="Cash paid"
                    fill={CHART.outflow}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Project status"
          description="All projects by lifecycle status."
        >
          {projectStatus.length === 0 ? (
            <EmptyState
              title="No projects"
              description="Create a project to see status distribution."
              className="border-0 bg-background/50 py-8 shadow-none"
            />
          ) : (
            <div className="space-y-3">
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-background"
                role="img"
                aria-label="Project status distribution"
              >
                {projectStatus.map((row) => (
                  <div
                    key={row.status}
                    className={cn(
                      'h-full',
                      row.status === 'ACTIVE' && 'bg-brand',
                      row.status === 'PLANNING' && 'bg-info',
                      row.status === 'ON_HOLD' && 'bg-warning',
                      row.status === 'COMPLETED' && 'bg-success',
                      row.status === 'CANCELLED' && 'bg-subtle',
                    )}
                    style={{
                      width: `${(row.count / projectStatusTotal) * 100}%`,
                    }}
                    title={`${row.label}: ${row.count}`}
                  />
                ))}
              </div>
              <ul className="space-y-2">
                {projectStatus.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-ink">
                      <ProjectStatusBadge status={row.status} />
                    </span>
                    <span className="tabular-money font-medium text-muted">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/projects"
                className="inline-block text-sm font-medium text-brand hover:underline"
              >
                View all projects
              </Link>
            </div>
          )}
        </DashboardSection>
      </div>

      {/* Project profitability */}
      <DashboardSection
        title="Project profitability"
        description="Cash received minus paid costs for the strongest projects by profit."
        actions={
          <Link
            to="/reports"
            className="text-sm font-medium text-brand hover:underline"
          >
            Full report
          </Link>
        }
      >
        {projectRows.length === 0 ? (
          <EmptyState
            title="No project financials yet"
            description="Profitability appears once payments and costs are recorded."
            className="border-0 bg-background/50 py-10 shadow-none"
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Project profitability">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-table-header pb-2 pr-3">Project</th>
                  <th className="text-table-header hidden pb-2 pr-3 md:table-cell">
                    Status
                  </th>
                  <th className="text-table-header hidden pb-2 pr-3 text-right lg:table-cell">
                    Contract
                  </th>
                  <th className="text-table-header pb-2 pr-3 text-right">Cost</th>
                  <th className="text-table-header hidden pb-2 pr-3 text-right sm:table-cell">
                    Cash in
                  </th>
                  <th className="text-table-header pb-2 pr-3 text-right">Profit</th>
                  <th className="text-table-header hidden pb-2 text-right md:table-cell">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr
                    key={row.projectId}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <Link
                        to={`/projects/${row.projectId}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-caption">{row.projectNumber}</p>
                    </td>
                    <td className="hidden py-2.5 pr-3 md:table-cell">
                      <ProjectStatusBadge status={row.status as ProjectStatus} />
                    </td>
                    <td className="hidden py-2.5 pr-3 text-right lg:table-cell">
                      <CurrencyValue
                        value={row.contractValue}
                        currency={currency}
                        size="sm"
                        tone="muted"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <CurrencyValue
                        value={row.costs}
                        currency={currency}
                        size="sm"
                        tone="muted"
                      />
                    </td>
                    <td className="hidden py-2.5 pr-3 text-right sm:table-cell">
                      <CurrencyValue
                        value={row.revenue}
                        currency={currency}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <CurrencyValue
                        value={row.profit}
                        currency={currency}
                        size="sm"
                        tone={money(row.profit).lt(0) ? 'danger' : 'default'}
                      />
                    </td>
                    <td className="hidden py-2.5 text-right tabular-money text-muted md:table-cell">
                      {row.profitMarginPercent !== null
                        ? `${row.profitMarginPercent.replace('.', ',')}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Budget + Needs attention */}
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardSection
          title="Budget performance"
          description="Current budget vs actual and committed costs."
        >
          {budgetRows.length === 0 ? (
            <EmptyState
              title="No budget data"
              description="Set project budgets to track utilization here."
              className="border-0 bg-background/50 py-10 shadow-none"
            />
          ) : (
            <ul className="space-y-4">
              {budgetRows.map((row) => {
                const util = row.utilization ?? 0;
                const tone = budgetTone(util);
                return (
                  <li key={row.projectId} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/projects/${row.projectId}?tab=budget`}
                          className="truncate text-sm font-medium text-ink hover:text-brand hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-caption">
                          {formatCurrency(row.actual.toFixed(2), currency)}
                          {money(row.committedCosts).gt(0)
                            ? ` + ${formatCurrency(row.committed.toFixed(2), currency)} committed`
                            : ''}{' '}
                          / {formatCurrency(row.budget.toFixed(2), currency)}
                          <span className="text-subtle"> · {budgetLabel(util)}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-caption tabular-money">
                        {formatCurrency(row.remaining.toFixed(2), currency)} left
                      </span>
                    </div>
                    <ProgressBar value={util} tone={tone} />
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title="Needs attention"
          description="Rule-based exceptions from overdue invoices and budget health."
        >
          {attentionItems.length === 0 ? (
            <EmptyState
              title="Nothing urgent"
              description="No overdue invoices or over-budget projects in the current data."
              className="border-0 bg-background/50 py-10 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-border">
              {attentionItems.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    to={item.to}
                    className="block rounded-[var(--radius-sm)] hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  >
                    <p
                      className={cn(
                        'text-xs font-semibold tracking-wide uppercase',
                        item.tone === 'danger' ? 'text-danger' : 'text-warning',
                      )}
                    >
                      {item.type}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="text-caption">{item.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      </div>

      {/* Outstanding invoices */}
      {canReadInvoices ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <InvoicePanel
            title="Outstanding customer invoices"
            description="Receivables prioritized by overdue, then due date."
            viewAllTo="/invoices?type=CUSTOMER"
            loading={customerInvoicesQuery.isLoading}
            error={customerInvoicesQuery.error}
            onRetry={() => void customerInvoicesQuery.refetch()}
            rows={outstandingCustomer}
            currency={currency}
            party={(inv) => inv.customer?.companyName ?? '—'}
          />
          <InvoicePanel
            title="Outstanding supplier invoices"
            description="Payables prioritized by overdue, then due date."
            viewAllTo="/invoices?type=SUPPLIER"
            loading={supplierInvoicesQuery.isLoading}
            error={supplierInvoicesQuery.error}
            onRetry={() => void supplierInvoicesQuery.refetch()}
            rows={outstandingSupplier}
            currency={currency}
            party={(inv) => inv.supplier?.companyName ?? '—'}
          />
        </div>
      ) : null}

      {/* Recent activity */}
      {canReadAudit ? (
        <DashboardSection
          title="Recent activity"
          description="Latest audit events across the company."
          actions={
            <Link
              to="/audit"
              className="text-sm font-medium text-brand hover:underline"
            >
              View audit log
            </Link>
          }
        >
          {activityQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : activityQuery.error ? (
            <ErrorState
              title="Unable to load activity"
              description={
                activityQuery.error instanceof ApiError
                  ? activityQuery.error.message
                  : 'Try again shortly.'
              }
              actionLabel="Retry"
              onAction={() => void activityQuery.refetch()}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          ) : !activityQuery.data?.data.length ? (
            <EmptyState
              title="No recent activity"
              description="Audit events will appear as users change records."
              className="border-0 bg-background/50 py-8 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-border">
              {activityQuery.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {entry.action}
                      <span className="font-normal text-muted">
                        {' '}
                        · {entry.entityType}
                        {entry.entityId ? ` ${entry.entityId.slice(0, 8)}…` : ''}
                      </span>
                    </p>
                    <p className="text-caption">
                      {entry.actor
                        ? `${entry.actor.firstName} ${entry.actor.lastName}`
                        : 'System'}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-caption"
                    dateTime={entry.createdAt}
                  >
                    {formatDateDe(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      ) : null}
    </div>
  );
}

function InvoicePanel({
  title,
  description,
  viewAllTo,
  loading,
  error,
  onRetry,
  rows,
  currency,
  party,
}: {
  title: string;
  description: string;
  viewAllTo: string;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  rows: InvoiceDto[];
  currency: string;
  party: (inv: InvoiceDto) => string;
}) {
  return (
    <DashboardSection
      title={title}
      description={description}
      actions={
        <Link
          to={viewAllTo}
          className="text-sm font-medium text-brand hover:underline"
        >
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load invoices"
          description={
            error instanceof ApiError ? error.message : 'Try again shortly.'
          }
          actionLabel="Retry"
          onAction={onRetry}
          className="border-0 bg-transparent p-0 shadow-none"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No outstanding invoices"
          description="All invoices in this category are settled or none exist yet."
          className="border-0 bg-background/50 py-8 shadow-none"
        />
      ) : (
        <div className="table-scroll" role="region" aria-label={title}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-table-header pb-2 pr-3">Invoice</th>
                <th className="text-table-header hidden pb-2 pr-3 sm:table-cell">
                  Party
                </th>
                <th className="text-table-header hidden pb-2 pr-3 md:table-cell">
                  Due
                </th>
                <th className="text-table-header pb-2 pr-3 text-right">
                  Outstanding
                </th>
                <th className="text-table-header pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-ink">{inv.invoiceNumber}</p>
                    <p className="text-caption sm:hidden">{party(inv)}</p>
                    {inv.project ? (
                      <p className="text-caption">{inv.project.projectNumber}</p>
                    ) : null}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">
                    {party(inv)}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-muted md:table-cell">
                    {formatDateDe(inv.dueDate)}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <CurrencyValue
                      value={invoiceOutstanding(inv).toFixed(2)}
                      currency={currency}
                      size="sm"
                      tone={inv.status === 'OVERDUE' ? 'danger' : 'default'}
                    />
                  </td>
                  <td className="py-2.5">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}
