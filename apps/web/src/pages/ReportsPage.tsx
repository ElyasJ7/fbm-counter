import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BUDGET_CATEGORY_LABELS,
  roleHasPermission,
  type BudgetCategory,
  type ProjectStatus,
  type ReportExportType,
} from '@fbm/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { FxRateIndicator } from '../components/currency/FxRateIndicator';
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
import { SkeletonCard } from '../components/ui/Skeleton';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { ApiError, apiDownload } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { fetchReports, reportsExportPath } from '../services/reports';
import { CHART_PALETTE, CHART_SERIES } from '../lib/chart-colors';

const CHART_COLORS = [...CHART_SERIES];

const CHART_GRID = CHART_PALETTE.grid;
const CHART_TICK = { fontSize: 11, fill: CHART_PALETTE.tick };

function toNumber(value: string) {
  return Number(value);
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function moneyTick(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return String(value);
}

function chartTooltipStyle() {
  return {
    borderRadius: 8,
    border: `1px solid ${CHART_PALETTE.grid}`,
    boxShadow: '0 1px 2px rgb(15 23 42 / 0.05)',
    fontSize: 12,
  };
}

async function downloadReport(
  type: ReportExportType,
  from: string,
  to: string,
  format: 'csv' | 'pdf' = 'csv',
  currency?: string,
) {
  const response = await apiDownload(
    reportsExportPath(type, {
      from: from || undefined,
      to: to || undefined,
      format,
      currency: currency || undefined,
    }),
  );
  if (!response.ok) {
    throw new Error('Export failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(
    disposition,
  );
  const filename = decodeURIComponent(
    match?.[1] ?? match?.[2] ?? `report-${type}.${format}`,
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

export function ReportsPage() {
  const { user } = useAuth();
  const { syncFromServer } = useDisplayCurrency();
  const canExport = user
    ? roleHasPermission(user.role, 'reports:export')
    : false;

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [
      'reports',
      appliedFrom,
      appliedTo,
      user?.preferredDisplayCurrency ?? 'company-default',
    ],
    queryFn: () =>
      fetchReports({
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        currency: user?.preferredDisplayCurrency ?? undefined,
      }),
  });

  useEffect(() => {
    if (query.data?.displayCurrency) {
      syncFromServer(query.data.displayCurrency);
    }
  }, [query.data?.displayCurrency, syncFromServer]);

  const cashFlowData = useMemo(
    () =>
      (query.data?.monthlyCashFlow ?? []).map((row) => ({
        month: formatMonthLabel(row.month),
        inflow: toNumber(row.inflow),
        outflow: toNumber(row.outflow),
        net: toNumber(row.net),
      })),
    [query.data?.monthlyCashFlow],
  );

  const categoryData = useMemo(
    () =>
      (query.data?.expensesByCategory ?? []).map((row) => ({
        name:
          BUDGET_CATEGORY_LABELS[row.category as BudgetCategory] ??
          row.category,
        value: toNumber(row.amount),
      })),
    [query.data?.expensesByCategory],
  );

  const hasCashActivity = cashFlowData.some(
    (row) => row.inflow !== 0 || row.outflow !== 0,
  );

  async function onExport(
    type: ReportExportType,
    format: 'csv' | 'pdf' = 'csv',
  ) {
    setExportError(null);
    setExporting(`${format}-${type}`);
    try {
      await downloadReport(
        type,
        appliedFrom,
        appliedTo,
        format,
        user?.preferredDisplayCurrency ?? undefined,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed',
      );
    } finally {
      setExporting(null);
    }
  }

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-2 h-7 w-40 animate-pulse rounded bg-border/70" />
          <div className="h-4 w-72 animate-pulse rounded bg-border/50" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-80" />
        </div>
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Reports"
          description="Profitability, cash flow, and exports."
        />
        <ErrorState
          title="Could not load reports"
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

  const data = query.data!;
  const { kpis, currency, period, projectProfitability, fx } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Profitability, cash flow, and exports."
        actions={
          canExport ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('summary', 'csv')}
              >
                {exporting === 'csv-summary' ? 'Exporting…' : 'CSV Summary'}
              </Button>
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('profitability', 'csv')}
              >
                {exporting === 'csv-profitability'
                  ? 'Exporting…'
                  : 'CSV Projects'}
              </Button>
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('cashflow', 'csv')}
              >
                {exporting === 'csv-cashflow' ? 'Exporting…' : 'CSV Cash flow'}
              </Button>
              <Button
                disabled={exporting !== null}
                onClick={() => void onExport('summary', 'pdf')}
              >
                {exporting === 'pdf-summary' ? 'Exporting…' : 'PDF Report'}
              </Button>
            </div>
          ) : null
        }
      />

      <FxRateIndicator fx={fx} />

      {exportError ? (
        <Alert tone="danger" title="Export failed">
          {exportError}
        </Alert>
      ) : null}

      <div>
        <FilterBar>
          <Input
            label="From"
            name="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            name="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button
              onClick={() => {
                setAppliedFrom(from);
                setAppliedTo(to);
              }}
            >
              Apply
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFrom('');
                setTo('');
                setAppliedFrom('');
                setAppliedTo('');
              }}
            >
              Reset
            </Button>
          </div>
        </FilterBar>
        <p className="mt-2 text-xs text-muted">
          {period.from || period.to
            ? `Current filter: ${period.from ?? '…'} – ${period.to ?? '…'}`
            : 'No date filter — all data / cash flow for the last 12 months.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash received"
          value={
            <CurrencyValue
              value={kpis.totalRevenue}
              currency={currency}
              size="lg"
            />
          }
        />
        <StatCard
          label="Actual costs"
          value={
            <CurrencyValue
              value={kpis.totalExpenses}
              currency={currency}
              size="lg"
            />
          }
        />
        <StatCard
          label="Gross profit"
          value={
            <CurrencyValue
              value={kpis.grossProfit}
              currency={currency}
              size="lg"
              tone={toNumber(kpis.grossProfit) < 0 ? 'danger' : 'default'}
            />
          }
        />
        <StatCard
          label="Available cash"
          value={
            <CurrencyValue
              value={kpis.availableCash}
              currency={currency}
              size="lg"
            />
          }
          hint={`AR ${formatCurrency(kpis.outstandingCustomerInvoices, currency)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Monthly cash flow"
          description="Inflows and outflows by month."
        >
          {!hasCashActivity ? (
            <EmptyState
              title="No payments"
              description="Cash flow appears once payments are recorded."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cashFlowData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={CHART_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={CHART_TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => moneyTick(Number(v))}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    formatter={(value) =>
                      formatCurrency(String(value ?? 0), currency)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="inflow"
                    name="Inflow"
                    fill={CHART_PALETTE.inflow}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="outflow"
                    name="Outflow"
                    fill={CHART_PALETTE.outflow}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title="Expenses by category"
          description="Paid expenses in the selected period."
        >
          {categoryData.length === 0 ? (
            <EmptyState
              title="No expenses"
              description="Categories appear after expenses are recorded."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={categoryData[index].name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle()}
                    formatter={(value) =>
                      formatCurrency(String(value ?? 0), currency)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Project profitability"
        description="Cash received, costs, and profit per project (cash-based)."
      >
        {projectProfitability.length === 0 ? (
          <EmptyState
            title="No projects"
            description="Create projects to see profitability."
          />
        ) : (
          <DataTable className="border-0 shadow-none">
            <table className="min-w-full text-left text-sm">
              <thead className={dataTableHeadClassName()}>
                <tr>
                  <th className={dataTableThClassName()}>Project</th>
                  <th className={dataTableThClassName()}>Status</th>
                  <th className={dataTableThClassName('right')}>Cash received</th>
                  <th className={dataTableThClassName('right')}>Costs</th>
                  <th className={dataTableThClassName('right')}>Profit</th>
                  <th className={dataTableThClassName('right')}>Margin</th>
                  <th className={dataTableThClassName('right')}>
                    Contract value
                  </th>
                </tr>
              </thead>
              <tbody>
                {projectProfitability.map((row) => (
                  <tr key={row.projectId} className={dataTableRowClassName()}>
                    <td className={dataTableTdClassName()}>
                      <Link
                        to={`/projects/${row.projectId}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {row.projectNumber}
                      </Link>
                      <div className="text-xs text-muted">{row.name}</div>
                    </td>
                    <td className={dataTableTdClassName()}>
                      <ProjectStatusBadge
                        status={row.status as ProjectStatus}
                      />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={row.revenue}
                        currency={currency}
                        size="sm"
                      />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={row.costs}
                        currency={currency}
                        size="sm"
                      />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={row.profit}
                        currency={currency}
                        size="sm"
                        tone={toNumber(row.profit) < 0 ? 'danger' : 'default'}
                      />
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      {row.profitMarginPercent != null
                        ? `${row.profitMarginPercent}%`
                        : '—'}
                    </td>
                    <td className={dataTableTdClassName('right')}>
                      <CurrencyValue
                        value={row.contractValue}
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
  );
}
