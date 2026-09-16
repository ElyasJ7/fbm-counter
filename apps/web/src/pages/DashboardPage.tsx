import { useQuery } from '@tanstack/react-query';
import {
  BUDGET_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  type BudgetCategory,
  type InvoiceStatus,
} from '@fbm/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { fetchDashboard } from '../services/dashboard';

const CHART_COLORS = [
  '#0f4c5c',
  '#e36414',
  '#15803d',
  '#b45309',
  '#64748b',
  '#1d4ed8',
  '#be123c',
  '#0f766e',
];

function toNumber(value: string) {
  return Number(value);
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

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

function ChartCard({
  title,
  description,
  children,
  empty,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card title={title} description={description}>
      {empty ? (
        <EmptyState
          title="No data yet"
          description="This chart will populate as invoices, payments, and expenses are recorded."
        />
      ) : (
        <div className="h-72 w-full">{children}</div>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Company financial overview." />
        <EmptyState
          title="Could not load dashboard"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
        />
      </div>
    );
  }

  const data = query.data!;
  const { kpis, charts, comparisons, currency } = data;

  const revenueExpenseData = charts.revenueVsExpenses.map((row) => ({
    month: formatMonthLabel(row.month),
    revenue: toNumber(row.revenue),
    expenses: toNumber(row.expenses),
  }));
  const cashFlowData = charts.monthlyCashFlow.map((row) => ({
    month: formatMonthLabel(row.month),
    inflow: toNumber(row.inflow),
    outflow: toNumber(row.outflow),
    net: toNumber(row.net),
  }));
  const profitData = charts.profitDevelopment.map((row) => ({
    month: formatMonthLabel(row.month),
    profit: toNumber(row.cumulativeProfit),
  }));
  const projectData = charts.projectProfitability.map((row) => ({
    name: row.projectNumber,
    fullName: row.name,
    profit: toNumber(row.profit),
    revenue: toNumber(row.revenue),
    costs: toNumber(row.costs),
  }));
  const categoryData = charts.expensesByCategory.map((row) => ({
    name:
      BUDGET_CATEGORY_LABELS[row.category as BudgetCategory] ?? row.category,
    value: toNumber(row.amount),
  }));
  const budgetData = [
    { name: 'Planned', amount: toNumber(charts.budgetVsActual.planned) },
    { name: 'Actual', amount: toNumber(charts.budgetVsActual.actual) },
  ];
  const invoiceStatusData = charts.invoiceStatusDistribution.map((row) => ({
    name: INVOICE_STATUS_LABELS[row.status as InvoiceStatus] ?? row.status,
    value: row.count,
  }));

  const hasCashActivity = cashFlowData.some(
    (row) => row.inflow !== 0 || row.outflow !== 0,
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName}. Live company financial overview from your project and ledger data.`}
      />

      <p className="mb-4 text-xs text-[var(--color-muted)]">
        {comparisons.note}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total revenue"
          value={formatCurrency(kpis.totalRevenue, currency)}
        />
        <KpiCard
          label="Total expenses"
          value={formatCurrency(kpis.totalExpenses, currency)}
        />
        <KpiCard
          label="Gross profit"
          value={formatCurrency(kpis.grossProfit, currency)}
        />
        <KpiCard
          label="Net profit"
          value={formatCurrency(kpis.netProfit, currency)}
          hint="Equals gross until overhead ledgers exist"
        />
        <KpiCard
          label="Available cash"
          value={formatCurrency(kpis.availableCash, currency)}
          hint="Incoming − outgoing payments"
        />
        <KpiCard
          label="Outstanding AR"
          value={formatCurrency(kpis.outstandingCustomerInvoices, currency)}
        />
        <KpiCard
          label="Outstanding AP"
          value={formatCurrency(kpis.outstandingSupplierInvoices, currency)}
        />
        <KpiCard label="Active projects" value={String(kpis.activeProjects)} />
        <KpiCard
          label="Total project value"
          value={formatCurrency(kpis.totalProjectValue, currency)}
        />
        <KpiCard
          label="Budget utilization"
          value={
            kpis.budgetUtilizationPercent !== null
              ? `${kpis.budgetUtilizationPercent.replace('.', ',')} %`
              : '—'
          }
          hint={`Budget ${formatCurrency(kpis.totalBudget, currency)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Revenue vs expenses"
          description="Monthly incoming vs outgoing payments."
          empty={!hasCashActivity}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueExpenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#0f4c5c" />
              <Bar dataKey="expenses" name="Expenses" fill="#e36414" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly cash flow"
          description="Net cash movement by month."
          empty={!hasCashActivity}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
              />
              <Legend />
              <Bar dataKey="inflow" name="Inflow" fill="#15803d" />
              <Bar dataKey="outflow" name="Outflow" fill="#b91c1c" />
              <Bar dataKey="net" name="Net" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Profit development"
          description="Cumulative profit from monthly payment activity."
          empty={!hasCashActivity}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Cumulative profit"
                stroke="#0f4c5c"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Project profitability"
          description="Revenue received minus costs paid per project."
          empty={projectData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
                labelFormatter={(_, payload) =>
                  String(payload?.[0]?.payload?.fullName ?? '')
                }
              />
              <Bar dataKey="profit" name="Profit" fill="#0f4c5c" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Expenses by category"
          description="Paid expense amounts grouped by budget category."
          empty={categoryData.every((row) => row.value === 0)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Budget vs actual"
          description="Planned budget lines versus recorded actual amounts."
          empty={
            toNumber(charts.budgetVsActual.planned) === 0 &&
            toNumber(charts.budgetVsActual.actual) === 0
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) =>
                  formatCurrency(Number(value ?? 0), currency)
                }
              />
              <Bar dataKey="amount" name="Amount" fill="#0f4c5c" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Invoice status distribution"
          description="Count of invoices by current status."
          empty={invoiceStatusData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={invoiceStatusData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
              >
                {invoiceStatusData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
