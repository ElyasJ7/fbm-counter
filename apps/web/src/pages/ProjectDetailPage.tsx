import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  SUBCONTRACTOR_TRADE_LABELS,
  roleHasPermission,
  type BudgetCategory,
} from '@fbm/shared';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Select } from '../components/ui/Select';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { StatCard } from '../components/ui/StatCard';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatCurrency, formatDateDe } from '../lib/format';
import {
  fetchProjectBudget,
  saveProjectBudget,
  type BudgetLineInput,
} from '../services/finance';
import {
  assignSubcontractorProject,
  fetchSubcontractors,
  unassignSubcontractorProject,
} from '../services/partners';
import {
  deleteProject,
  fetchProject,
  fetchProjectActivity,
  fetchProjectSubcontractors,
} from '../services/projects';
import { DocumentsPage } from './DocumentsPage';
import { ExpensesPage } from './ExpensesPage';
import { InvoicesPage } from './InvoicesPage';
import { PaymentsPage } from './PaymentsPage';

const READY_TABS = [
  'overview',
  'financials',
  'budget',
  'expenses',
  'invoices',
  'payments',
  'subcontractors',
  'documents',
  'activity',
] as const;

type ReadyTab = (typeof READY_TABS)[number];

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'financials', label: 'Financials' },
  { id: 'budget', label: 'Budget' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'subcontractors', label: 'Subcontractors' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
] as const;

function isReadyTab(value: string | null): value is ReadyTab {
  return READY_TABS.includes(value as ReadyTab);
}

function Metric({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <StatCard
      label={label}
      value={value}
      hint={hint}
      className={emphasize ? undefined : 'bg-background/50 shadow-none'}
    />
  );
}

type DraftLine = {
  category: BudgetCategory;
  plannedAmount: string;
  notes: string;
};

function ProjectBudgetTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'finances:write')
    : false;

  const budgetQuery = useQuery({
    queryKey: ['budget', projectId],
    queryFn: () => fetchProjectBudget(projectId, { sync: true }),
  });

  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const savedByCategory = useMemo(() => {
    return new Map(
      (budgetQuery.data?.data ?? []).map((line) => [line.category, line]),
    );
  }, [budgetQuery.data]);

  useEffect(() => {
    if (!budgetQuery.data) return;
    const byCategory = new Map(
      budgetQuery.data.data.map((line) => [line.category, line]),
    );
    setDraft(
      BUDGET_CATEGORIES.map((category) => {
        const existing = byCategory.get(category);
        return {
          category,
          plannedAmount: existing?.plannedAmount ?? '0',
          notes: existing?.notes ?? '',
        };
      }),
    );
  }, [budgetQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const lines: BudgetLineInput[] = draft
        .filter((line) => Number(line.plannedAmount) !== 0 || line.notes.trim())
        .map((line) => ({
          category: line.category,
          plannedAmount: line.plannedAmount.trim() || '0',
          notes: line.notes.trim() || undefined,
        }));
      if (lines.length === 0) {
        throw new Error(
          'Mindestens eine Budgetzeile mit Betrag erforderlich.',
        );
      }
      return saveProjectBudget(projectId, lines);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['budget', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Speichern fehlgeschlagen',
      );
    },
  });

  if (budgetQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (budgetQuery.error) {
    return (
      <EmptyState
        title="Budget konnte nicht geladen werden"
        description={
          budgetQuery.error instanceof ApiError
            ? budgetQuery.error.message
            : 'Unerwarteter Fehler'
        }
      />
    );
  }

  return (
    <Card title="Budget nach Kategorie">
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Geplante Beträge je Kostenkategorie. Ist- und gebunden Werte werden aus
        Ausgaben synchronisiert.
      </p>
      <div className="table-scroll">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Kategorie</th>
              <th className="px-3 py-2 font-medium">Geplant</th>
              <th className="px-3 py-2 font-medium">Gebunden</th>
              <th className="px-3 py-2 font-medium">Ist</th>
              <th className="px-3 py-2 font-medium">Rest</th>
              <th className="px-3 py-2 font-medium">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((line, index) => {
              const saved = savedByCategory.get(line.category);
              return (
                <tr key={line.category} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">
                    {BUDGET_CATEGORY_LABELS[line.category]}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <input
                        className="h-9 w-28 rounded-md border border-[var(--color-border)] bg-white px-2"
                        name={`planned-${line.category}`}
                        aria-label={`Geplant ${BUDGET_CATEGORY_LABELS[line.category]}`}
                        value={line.plannedAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, plannedAmount: value }
                                : row,
                            ),
                          );
                        }}
                      />
                    ) : (
                      formatCurrency(line.plannedAmount)
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {formatCurrency(saved?.committedAmount ?? '0')}
                  </td>
                  <td className="px-3 py-3">
                    {formatCurrency(saved?.actualAmount ?? '0')}
                  </td>
                  <td className="px-3 py-3">
                    {formatCurrency(saved?.remainingAmount ?? line.plannedAmount)}
                  </td>
                  <td className="px-3 py-3">
                    {canWrite ? (
                      <input
                        className="h-9 w-full min-w-40 rounded-md border border-[var(--color-border)] bg-white px-2"
                        name={`notes-${line.category}`}
                        aria-label={`Notiz ${BUDGET_CATEGORY_LABELS[line.category]}`}
                        value={line.notes}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, notes: value } : row,
                            ),
                          );
                        }}
                      />
                    ) : (
                      line.notes || '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}
      {canWrite ? (
        <div className="mt-4">
          <Button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Budget speichern
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function ProjectFinancialsTab({
  overview,
  currency,
  onTab,
}: {
  projectId: string;
  overview: {
    contractValue: string;
    budget: string;
    actualCosts: string;
    committedCosts: string;
    revenueReceived: string;
    outstandingRevenue: string;
    currentProfit: string;
    projectedProfit: string;
    profitMarginPercent: string | null;
    remainingBudget: string;
    financeDataAvailable: boolean;
  };
  currency: string;
  onTab: (tab: ReadyTab) => void;
}) {
  return (
    <div className="space-y-4">
      <Card title="Financial position" description="Project finance KPIs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Contract value"
            value={
              <CurrencyValue value={overview.contractValue} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Current budget"
            value={
              <CurrencyValue value={overview.budget} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Actual cost"
            value={
              <CurrencyValue value={overview.actualCosts} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Committed"
            value={
              <CurrencyValue value={overview.committedCosts} currency={currency} size="md" />
            }
          />
          <Metric
            label="Cash received"
            value={
              <CurrencyValue value={overview.revenueReceived} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Accounts receivable"
            value={
              <CurrencyValue value={overview.outstandingRevenue} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Current profit"
            value={
              <CurrencyValue value={overview.currentProfit} currency={currency} size="md" />
            }
            emphasize
          />
          <Metric
            label="Projected profit"
            value={
              <CurrencyValue value={overview.projectedProfit} currency={currency} size="md" />
            }
          />
          <Metric
            label="Margin"
            value={
              overview.profitMarginPercent !== null
                ? `${overview.profitMarginPercent.replace('.', ',')} %`
                : '—'
            }
          />
          <Metric
            label="Remaining budget"
            value={
              <CurrencyValue value={overview.remainingBudget} currency={currency} size="md" />
            }
          />
        </div>
        {!overview.financeDataAvailable ? (
          <p className="mt-4 text-sm text-muted">
            No financial movements for this project yet.
          </p>
        ) : null}
      </Card>
      <Card title="Quick links">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onTab('budget')}>
            Budget
          </Button>
          <Button variant="secondary" onClick={() => onTab('expenses')}>
            Expenses
          </Button>
          <Button variant="secondary" onClick={() => onTab('invoices')}>
            Invoices
          </Button>
          <Button variant="secondary" onClick={() => onTab('payments')}>
            Payments
          </Button>
          <Link to={`/reports`}>
            <Button variant="secondary">Reports</Button>
          </Link>
          <Link to={`/finances`}>
            <Button variant="secondary">Finances</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ProjectSubcontractorsTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'subcontractors:write')
    : false;
  const [subcontractorId, setSubcontractorId] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const linksQuery = useQuery({
    queryKey: ['project-subcontractors', projectId],
    queryFn: () => fetchProjectSubcontractors(projectId),
  });

  const allSubsQuery = useQuery({
    queryKey: ['subcontractors', 'project-assign'],
    queryFn: () => fetchSubcontractors({ page: 1, pageSize: 100 }),
    enabled: canWrite,
  });

  const assignedIds = new Set(
    (linksQuery.data ?? []).map((link) => link.subcontractor.id),
  );
  const availableOptions = (allSubsQuery.data?.data ?? [])
    .filter((sub) => !assignedIds.has(sub.id))
    .map((sub) => ({
      value: sub.id,
      label: `${sub.companyName} (${SUBCONTRACTOR_TRADE_LABELS[sub.trade]})`,
    }));

  const assignMutation = useMutation({
    mutationFn: () =>
      assignSubcontractorProject(subcontractorId, {
        projectId,
        contractValue: contractValue.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async () => {
      setSubcontractorId('');
      setContractValue('');
      setNotes('');
      setFormError(null);
      await queryClient.invalidateQueries({
        queryKey: ['project-subcontractors', projectId],
      });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? error.message : 'Zuweisung fehlgeschlagen',
      );
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (subId: string) =>
      unassignSubcontractorProject(subId, projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project-subcontractors', projectId],
      });
    },
  });

  if (linksQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (linksQuery.error) {
    return (
      <EmptyState
        title="Nachunternehmer konnten nicht geladen werden"
        description={
          linksQuery.error instanceof ApiError
            ? linksQuery.error.message
            : 'Unerwarteter Fehler'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card title="Nachunternehmer zuweisen">
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Nachunternehmer"
              name="subcontractorId"
              value={subcontractorId}
              onChange={(e) => setSubcontractorId(e.target.value)}
              options={availableOptions}
              placeholder="Auswählen…"
            />
            <Input
              label="Auftragswert"
              name="contractValue"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
            />
            <Input
              label="Notiz"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4">
            <Button
              disabled={!subcontractorId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Zuweisen
            </Button>
          </div>
        </Card>
      ) : null}

      <Card title="Zugewiesene Nachunternehmer">
        {(linksQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Keine Nachunternehmer"
            description="Weisen Sie Nachunternehmer diesem Projekt zu."
          />
        ) : (
          <div className="table-scroll">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Firma</th>
                  <th className="px-3 py-2 font-medium">Gewerk</th>
                  <th className="px-3 py-2 font-medium">Auftragswert</th>
                  <th className="px-3 py-2 font-medium">Kontakt</th>
                  {canWrite ? (
                    <th className="px-3 py-2 font-medium">Aktionen</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {linksQuery.data?.map((link) => (
                  <tr
                    key={link.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-3 py-3">
                      <Link
                        to={`/subcontractors/${link.subcontractor.id}`}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {link.subcontractor.companyName}
                      </Link>
                      {link.notes ? (
                        <div className="text-xs text-[var(--color-muted)]">
                          {link.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {SUBCONTRACTOR_TRADE_LABELS[link.subcontractor.trade]}
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(link.contractValue)}
                    </td>
                    <td className="px-3 py-3">
                      {link.subcontractor.contactPerson ||
                        link.subcontractor.email ||
                        '—'}
                    </td>
                    {canWrite ? (
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Zuweisung von „${link.subcontractor.companyName}“ entfernen?`,
                              )
                            ) {
                              unassignMutation.mutate(link.subcontractor.id);
                            }
                          }}
                        >
                          Entfernen
                        </Button>
                      </td>
                    ) : null}
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

function ProjectActivityTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const canRead = user ? roleHasPermission(user.role, 'audit:read') : false;

  const query = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => fetchProjectActivity(projectId),
    enabled: canRead,
    retry: false,
  });

  if (!canRead) {
    return (
      <EmptyState
        title="Kein Zugriff"
        description="Audit-Aktivität ist nur für Verwaltung und Admins sichtbar."
      />
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error) {
    return (
      <EmptyState
        title="Aktivität konnte nicht geladen werden"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Unerwarteter Fehler'
        }
      />
    );
  }

  if ((query.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="Noch keine Aktivität"
        description="Änderungen an diesem Projekt erscheinen hier."
      />
    );
  }

  return (
    <Card title="Aktivitätsprotokoll" description="Letzte 50 Ereignisse">
      <div className="table-scroll">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Zeitpunkt</th>
              <th className="px-3 py-2 font-medium">Aktion</th>
              <th className="px-3 py-2 font-medium">Objekt</th>
              <th className="px-3 py-2 font-medium">Benutzer</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-border)] last:border-0"
              >
                <td className="px-3 py-3">{formatDateDe(row.createdAt)}</td>
                <td className="px-3 py-3 font-medium">{row.action}</td>
                <td className="px-3 py-3">
                  {row.entityType}
                  {row.entityId ? (
                    <div className="text-xs text-[var(--color-muted)]">
                      {row.entityId}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  {row.actor
                    ? `${row.actor.firstName} ${row.actor.lastName}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;
  const canDelete = user
    ? roleHasPermission(user.role, 'projects:delete')
    : false;

  const activeTab: ReadyTab = isReadyTab(searchParams.get('tab'))
    ? (searchParams.get('tab') as ReadyTab)
    : 'overview';

  const query = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  if (!id) {
    return <Navigate to="/projects" replace />;
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard className="h-24" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Project"
          breadcrumbs={[
            { label: 'Projects', to: '/projects' },
            { label: 'Not found' },
          ]}
        />
        <ErrorState
          title="Project not found"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'The requested project could not be loaded.'
          }
          actionLabel="Back to projects"
          actionTo="/projects"
        />
      </div>
    );
  }

  const project = query.data;
  const overview = project.overview;
  const site = [project.siteStreet, project.sitePostalCode, project.siteCity]
    .filter(Boolean)
    .join(', ');

  const setTab = (tabId: ReadyTab) => {
    const next = new URLSearchParams(searchParams);
    if (tabId === 'overview') next.delete('tab');
    else next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.projectNumber} · ${project.customer.companyName}`}
        breadcrumbs={[
          { label: 'Projects', to: '/projects' },
          { label: project.projectNumber },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <Link to={`/projects/${project.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            ) : null}
            {canDelete ? (
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete project “${project.projectNumber}”?`,
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      <Card padding="sm" className="!shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectStatusBadge status={project.status} />
            {project.projectManager ? (
              <span className="text-sm text-muted">
                Manager:{' '}
                <span className="font-medium text-ink">
                  {project.projectManager.firstName}{' '}
                  {project.projectManager.lastName}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted">No manager assigned</span>
            )}
            <span className="text-sm text-muted">
              Customer:{' '}
              <span className="font-medium text-ink">
                {project.customer.companyName}
              </span>
            </span>
          </div>
          <div className="w-full max-w-xs">
            <p className="mb-1 text-caption">Progress</p>
            <ProgressBar value={project.progressPercent} />
          </div>
        </div>
      </Card>

      <Tabs
        aria-label="Project sections"
        items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={(id) => setTab(id as ReadyTab)}
      />

      {activeTab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card
              title="Financial summary"
              description="Contract, budget, costs, cash, and profit"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Contract value"
                  value={
                    <CurrencyValue
                      value={overview.contractValue}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  emphasize
                />
                <Metric
                  label="Current budget"
                  value={
                    <CurrencyValue
                      value={overview.budget}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  emphasize
                />
                <Metric
                  label="Actual cost"
                  value={
                    <CurrencyValue
                      value={overview.actualCosts}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  hint={
                    overview.financeDataAvailable
                      ? 'Invoice-wins cost policy'
                      : undefined
                  }
                  emphasize
                />
                <Metric
                  label="Cash received"
                  value={
                    <CurrencyValue
                      value={overview.revenueReceived}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  emphasize
                />
                <Metric
                  label="Accounts receivable"
                  value={
                    <CurrencyValue
                      value={overview.outstandingRevenue}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  emphasize
                />
                <Metric
                  label="Profit"
                  value={
                    <CurrencyValue
                      value={overview.currentProfit}
                      currency={overview.currency}
                      size="md"
                    />
                  }
                  hint="Cash received − actual costs"
                  emphasize
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Committed"
                  value={
                    <CurrencyValue
                      value={overview.committedCosts}
                      currency={overview.currency}
                      size="sm"
                    />
                  }
                />
                <Metric
                  label="Projected profit"
                  value={
                    <CurrencyValue
                      value={overview.projectedProfit}
                      currency={overview.currency}
                      size="sm"
                    />
                  }
                />
                <Metric
                  label="Margin"
                  value={
                    overview.profitMarginPercent !== null
                      ? `${overview.profitMarginPercent.replace('.', ',')} %`
                      : '—'
                  }
                />
                <Metric
                  label="Remaining budget"
                  value={
                    <CurrencyValue
                      value={overview.remainingBudget}
                      currency={overview.currency}
                      size="sm"
                    />
                  }
                />
              </div>
              {!overview.financeDataAvailable ? (
                <p className="mt-4 text-sm text-muted">
                  Cost and revenue figures stay at zero until invoices,
                  payments, and expenses are recorded for this project.
                </p>
              ) : null}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Project information">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-caption">Customer</dt>
                  <dd className="font-medium text-ink">
                    {project.customer.companyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption">Customer contact</dt>
                  <dd className="text-ink">{project.customerContact ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-caption">Site</dt>
                  <dd className="text-ink">{site || '—'}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-caption">Start</dt>
                    <dd className="text-ink">
                      {formatDateDe(project.startDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption">Expected end</dt>
                    <dd className="text-ink">
                      {formatDateDe(project.expectedCompletionDate)}
                    </dd>
                  </div>
                </div>
                <div>
                  <dt className="text-caption">Initial budget</dt>
                  <dd className="text-ink">
                    {formatCurrency(project.initialBudget, project.currency)}
                  </dd>
                </div>
              </dl>
            </Card>
            {project.description ? (
              <Card title="Description">
                <p className="text-sm whitespace-pre-wrap text-muted">
                  {project.description}
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === 'financials' ? (
        <ProjectFinancialsTab
          projectId={project.id}
          overview={overview}
          currency={overview.currency}
          onTab={setTab}
        />
      ) : null}
      {activeTab === 'budget' ? <ProjectBudgetTab projectId={project.id} /> : null}
      {activeTab === 'expenses' ? (
        <ExpensesPage embeddedProjectId={project.id} compact />
      ) : null}
      {activeTab === 'invoices' ? (
        <InvoicesPage embeddedProjectId={project.id} compact />
      ) : null}
      {activeTab === 'payments' ? (
        <PaymentsPage embeddedProjectId={project.id} compact />
      ) : null}
      {activeTab === 'subcontractors' ? (
        <ProjectSubcontractorsTab projectId={project.id} />
      ) : null}
      {activeTab === 'documents' ? (
        <DocumentsPage embeddedProjectId={project.id} compact />
      ) : null}
      {activeTab === 'activity' ? (
        <ProjectActivityTab projectId={project.id} />
      ) : null}
    </div>
  );
}
