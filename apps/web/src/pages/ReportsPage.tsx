import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError, apiDownload } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { fetchReports, reportsExportPath } from '../services/reports';

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

async function downloadReport(
  type: ReportExportType,
  from: string,
  to: string,
  format: 'csv' | 'pdf' = 'csv',
) {
  const response = await apiDownload(
    reportsExportPath(type, {
      from: from || undefined,
      to: to || undefined,
      format,
    }),
  );
  if (!response.ok) {
    throw new Error('Export fehlgeschlagen');
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
    queryKey: ['reports', appliedFrom, appliedTo],
    queryFn: () =>
      fetchReports({
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
      }),
  });

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
      await downloadReport(type, appliedFrom, appliedTo, format);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export fehlgeschlagen',
      );
    } finally {
      setExporting(null);
    }
  }

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
        <PageHeader
          title="Berichte"
          description="Rentabilität, Cashflow und Exporte."
        />
        <EmptyState
          title="Berichte konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      </div>
    );
  }

  const data = query.data!;
  const { kpis, currency, period, projectProfitability } = data;

  return (
    <div>
      <PageHeader
        title="Berichte"
        description="Unternehmensweite Rentabilität, Cashflow und Exporte."
        actions={
          canExport ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('summary', 'csv')}
              >
                {exporting === 'csv-summary' ? 'Export…' : 'CSV Gesamt'}
              </Button>
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('profitability', 'csv')}
              >
                {exporting === 'csv-profitability' ? 'Export…' : 'CSV Projekte'}
              </Button>
              <Button
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => void onExport('cashflow', 'csv')}
              >
                {exporting === 'csv-cashflow' ? 'Export…' : 'CSV Cashflow'}
              </Button>
              <Button
                disabled={exporting !== null}
                onClick={() => void onExport('summary', 'pdf')}
              >
                {exporting === 'pdf-summary' ? 'Export…' : 'PDF Bericht'}
              </Button>
            </div>
          ) : null
        }
      />

      {exportError ? (
        <p className="mb-4 text-sm text-[var(--color-danger)]" role="alert">
          {exportError}
        </p>
      ) : null}

      <Card className="mb-6" title="Zeitraum">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Von"
            name="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Bis"
            name="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <div className="flex items-end gap-2 md:col-span-2">
            <Button
              onClick={() => {
                setAppliedFrom(from);
                setAppliedTo(to);
              }}
            >
              Anwenden
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
              Zurücksetzen
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {period.from || period.to
            ? `Aktueller Filter: ${period.from ?? '…'} – ${period.to ?? '…'}`
            : 'Kein Datumsfilter — alle Daten / Cashflow der letzten 12 Monate.'}
        </p>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <KpiCard
          label="Verfügbare Liquidität"
          value={formatCurrency(kpis.availableCash, currency)}
          hint={`Offene Forderungen ${formatCurrency(kpis.outstandingCustomerInvoices, currency)}`}
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Card
          title="Monatlicher Cashflow"
          description="Zahlungseingänge und -ausgänge nach Monat."
        >
          {!hasCashActivity ? (
            <EmptyState
              title="Keine Zahlungen"
              description="Cashflow erscheint, sobald Zahlungen erfasst sind."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(String(value ?? 0), currency)
                    }
                  />
                  <Legend />
                  <Bar dataKey="inflow" name="Eingänge" fill="#15803d" />
                  <Bar dataKey="outflow" name="Ausgänge" fill="#be123c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title="Ausgaben nach Kategorie"
          description="Bezahlte Ausgaben im gewählten Zeitraum."
        >
          {categoryData.length === 0 ? (
            <EmptyState
              title="Keine Ausgaben"
              description="Kategorien erscheinen nach erfassten Ausgaben."
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
                    formatter={(value) =>
                      formatCurrency(String(value ?? 0), currency)
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Projektrentabilität"
        description="Erlös, Kosten und Gewinn je Projekt (bezahlt)."
      >
        {projectProfitability.length === 0 ? (
          <EmptyState
            title="Keine Projekte"
            description="Legen Sie Projekte an, um Rentabilität zu sehen."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Projekt</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Erlös</th>
                  <th className="px-3 py-2 font-medium">Kosten</th>
                  <th className="px-3 py-2 font-medium">Gewinn</th>
                  <th className="px-3 py-2 font-medium">Marge</th>
                  <th className="px-3 py-2 font-medium">Auftragswert</th>
                </tr>
              </thead>
              <tbody>
                {projectProfitability.map((row) => (
                  <tr
                    key={row.projectId}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-3 py-3">
                      <Link
                        to={`/projects/${row.projectId}`}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {row.projectNumber}
                      </Link>
                      <div className="text-xs text-[var(--color-muted)]">
                        {row.name}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ProjectStatusBadge
                        status={row.status as ProjectStatus}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(row.revenue, currency)}
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(row.costs, currency)}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {formatCurrency(row.profit, currency)}
                    </td>
                    <td className="px-3 py-3">
                      {row.profitMarginPercent != null
                        ? `${row.profitMarginPercent}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(row.contractValue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
