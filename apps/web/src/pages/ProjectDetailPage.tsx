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
  roleHasPermission,
  type BudgetCategory,
} from '@fbm/shared';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { formatCurrency, formatDateDe } from '../lib/format';
import {
  fetchProjectBudget,
  saveProjectBudget,
  type BudgetLineInput,
} from '../services/finance';
import { deleteProject, fetchProject } from '../services/projects';
import { ExpensesPage } from './ExpensesPage';
import { InvoicesPage } from './InvoicesPage';
import { PaymentsPage } from './PaymentsPage';

const READY_TABS = [
  'overview',
  'budget',
  'expenses',
  'invoices',
  'payments',
] as const;

type ReadyTab = (typeof READY_TABS)[number];

const tabs = [
  { id: 'overview', label: 'Übersicht', ready: true },
  { id: 'financials', label: 'Finanzen', ready: false },
  { id: 'budget', label: 'Budget', ready: true },
  { id: 'expenses', label: 'Ausgaben', ready: true },
  { id: 'invoices', label: 'Rechnungen', ready: true },
  { id: 'payments', label: 'Zahlungen', ready: true },
  { id: 'subcontractors', label: 'Nachunternehmer', ready: false },
  { id: 'documents', label: 'Dokumente', ready: false },
  { id: 'activity', label: 'Aktivität', ready: false },
] as const;

function isReadyTab(value: string | null): value is ReadyTab {
  return READY_TABS.includes(value as ReadyTab);
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-slate-50 p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
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
      <div className="overflow-x-auto">
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
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <EmptyState
        title="Projekt nicht gefunden"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Das angeforderte Projekt konnte nicht geladen werden.'
        }
        actionLabel="Zurück zu Projekten"
        onAction={() => navigate('/projects')}
      />
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
    <div>
      <PageHeader
        title={project.name}
        description={`${project.projectNumber} · ${project.customer.companyName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/projects">
              <Button variant="secondary">Alle Projekte</Button>
            </Link>
            {canWrite ? (
              <Link to={`/projects/${project.id}/edit`}>
                <Button variant="secondary">Bearbeiten</Button>
              </Link>
            ) : null}
            {canDelete ? (
              <Button
                variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Projekt „${project.projectNumber}“ löschen?`,
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Löschen
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ProjectStatusBadge status={project.status} />
        <span className="text-sm text-[var(--color-muted)]">
          Fortschritt {project.progressPercent}%
        </span>
        {project.projectManager ? (
          <span className="text-sm text-[var(--color-muted)]">
            PM: {project.projectManager.firstName}{' '}
            {project.projectManager.lastName}
          </span>
        ) : null}
      </div>

      <div
        className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]"
        role="tablist"
        aria-label="Projektbereiche"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={!tab.ready}
              onClick={() => {
                if (tab.ready) setTab(tab.id as ReadyTab);
              }}
              className={cn(
                'shrink-0 px-3 py-2 text-sm font-medium',
                selected
                  ? 'border-b-2 border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'text-[var(--color-muted)]',
                !tab.ready && 'cursor-not-allowed opacity-50',
              )}
              title={tab.ready ? undefined : 'Verfügbar in einer späteren Phase'}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Projektübersicht">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Auftragswert"
                value={formatCurrency(overview.contractValue, overview.currency)}
              />
              <Metric
                label="Aktuelles Budget"
                value={formatCurrency(overview.budget, overview.currency)}
              />
              <Metric
                label="Ist-Kosten"
                value={formatCurrency(overview.actualCosts, overview.currency)}
                hint={
                  overview.financeDataAvailable
                    ? 'Aus Ausgaben'
                    : undefined
                }
              />
              <Metric
                label="Gebundene Kosten"
                value={formatCurrency(
                  overview.committedCosts,
                  overview.currency,
                )}
                hint={
                  overview.financeDataAvailable
                    ? 'Aus offenen Verpflichtungen'
                    : undefined
                }
              />
              <Metric
                label="Erhaltene Erlöse"
                value={formatCurrency(
                  overview.revenueReceived,
                  overview.currency,
                )}
                hint={
                  overview.financeDataAvailable
                    ? 'Aus Kundenzahlungen'
                    : undefined
                }
              />
              <Metric
                label="Offene Erlöse"
                value={formatCurrency(
                  overview.outstandingRevenue,
                  overview.currency,
                )}
                hint={
                  overview.financeDataAvailable
                    ? 'Aus offenen Ausgangsrechnungen'
                    : undefined
                }
              />
              <Metric
                label="Aktueller Gewinn"
                value={formatCurrency(overview.currentProfit, overview.currency)}
                hint="Erlöse − Ist-Kosten"
              />
              <Metric
                label="Prognostizierter Gewinn"
                value={formatCurrency(
                  overview.projectedProfit,
                  overview.currency,
                )}
                hint="Auftrag − Prognosekosten"
              />
              <Metric
                label="Gewinnmarge"
                value={
                  overview.profitMarginPercent !== null
                    ? `${overview.profitMarginPercent.replace('.', ',')} %`
                    : '—'
                }
              />
              <Metric
                label="Restbudget"
                value={formatCurrency(
                  overview.remainingBudget,
                  overview.currency,
                )}
                hint="Budget − Ist − gebunden"
              />
            </div>
            {!overview.financeDataAvailable ? (
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                Kosten- und Erlösdaten sind noch null, bis Rechnungen, Zahlungen
                und Ausgaben für dieses Projekt erfasst werden. Der
                prognostizierte Gewinn entspricht derzeit dem Auftragswert, weil
                noch keine Prognosekosten vorliegen.
              </p>
            ) : null}
          </Card>

          <div className="space-y-4">
            <Card title="Details">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--color-muted)]">Kunde</dt>
                  <dd className="font-medium">
                    {project.customer.companyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Kundenkontakt</dt>
                  <dd>{project.customerContact ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Baustelle</dt>
                  <dd>{site || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Start</dt>
                  <dd>{formatDateDe(project.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">
                    Voraussichtliches Ende
                  </dt>
                  <dd>{formatDateDe(project.expectedCompletionDate)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Initialbudget</dt>
                  <dd>
                    {formatCurrency(project.initialBudget, project.currency)}
                  </dd>
                </div>
              </dl>
            </Card>
            {project.description ? (
              <Card title="Beschreibung">
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {project.description}
                </p>
              </Card>
            ) : null}
          </div>
        </div>
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
    </div>
  );
}
