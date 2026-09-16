import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  roleHasPermission,
  type BudgetCategory,
  type ExpenseStatus,
} from '@fbm/shared';
import { ExpenseStatusBadge } from '../components/finance/StatusBadges';
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
  approveExpense,
  createExpense,
  deleteExpense,
  fetchExpenses,
  fetchSuppliers,
  type ExpenseInput,
} from '../services/finance';
import { fetchProjects } from '../services/projects';

const emptyForm: ExpenseInput = {
  description: '',
  netAmount: '',
  taxRate: '19',
  category: 'OTHER',
  status: 'DRAFT',
  projectId: '',
  supplierId: '',
};

type ExpensesPageProps = {
  embeddedProjectId?: string;
  compact?: boolean;
};

export function ExpensesPage({
  embeddedProjectId,
  compact = false,
}: ExpensesPageProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canWrite = user
    ? roleHasPermission(user.role, 'expenses:write')
    : false;
  const canApprove = user
    ? roleHasPermission(user.role, 'finances:approve') ||
      roleHasPermission(user.role, 'expenses:write')
    : false;

  const projectFilter =
    embeddedProjectId ?? searchParams.get('projectId') ?? '';
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<ExpenseStatus | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExpenseInput>({
    ...emptyForm,
    projectId: projectFilter,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['expenses', page, search, status, projectFilter],
    queryFn: () =>
      fetchExpenses({
        page,
        pageSize: compact ? 10 : 20,
        search,
        status,
        projectId: projectFilter || undefined,
      }),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'expense-form'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: showForm && !embeddedProjectId,
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'expense-form'],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 100 }),
    enabled: showForm,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ExpenseInput = {
        description: form.description.trim(),
        netAmount: form.netAmount.trim(),
        taxRate: form.taxRate?.trim() || '19',
        category: form.category || 'OTHER',
        status: form.status || 'DRAFT',
        projectId: form.projectId || projectFilter || undefined,
        supplierId: form.supplierId || undefined,
        invoiceNumber: form.invoiceNumber?.trim() || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes?.trim() || undefined,
      };
      return createExpense(payload);
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm({ ...emptyForm, projectId: projectFilter });
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
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

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveExpense(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const categoryOptions = useMemo(
    () =>
      BUDGET_CATEGORIES.map((value) => ({
        value,
        label: BUDGET_CATEGORY_LABELS[value],
      })),
    [],
  );

  const statusOptions = useMemo(
    () =>
      EXPENSE_STATUSES.map((value) => ({
        value,
        label: EXPENSE_STATUS_LABELS[value],
      })),
    [],
  );

  const content = (
    <>
      {!compact ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <Input
            label="Suche"
            name="search"
            value={search}
            placeholder="Nummer, Beschreibung…"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Status"
            name="status"
            value={status}
            placeholder="Alle Status"
            options={statusOptions}
            onChange={(e) => {
              setStatus(e.target.value as ExpenseStatus | '');
              setPage(1);
            }}
          />
        </div>
      ) : null}

      {showForm && canWrite ? (
        <Card className="mb-6" title="Neue Ausgabe">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Beschreibung"
              name="description"
              required
              className="md:col-span-2"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
            <Input
              label="Nettobetrag (€)"
              name="netAmount"
              required
              value={form.netAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, netAmount: e.target.value }))
              }
            />
            <Input
              label="MwSt. %"
              name="taxRate"
              value={form.taxRate ?? '19'}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, taxRate: e.target.value }))
              }
            />
            <Select
              label="Kategorie"
              name="category"
              value={form.category ?? 'OTHER'}
              options={categoryOptions}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value as BudgetCategory,
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
                  status: e.target.value as ExpenseStatus,
                }))
              }
            />
            {!embeddedProjectId ? (
              <Select
                label="Projekt"
                name="projectId"
                value={form.projectId ?? ''}
                placeholder="Kein Projekt"
                options={(projectsQuery.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.projectNumber} · ${p.name}`,
                }))}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, projectId: e.target.value }))
                }
              />
            ) : null}
            <Select
              label="Lieferant"
              name="supplierId"
              value={form.supplierId ?? ''}
              placeholder="Kein Lieferant"
              options={(suppliersQuery.data?.data ?? []).map((s) => ({
                value: s.id,
                label: s.companyName,
              }))}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, supplierId: e.target.value }))
              }
            />
            <Input
              label="Rechnungsnr."
              name="invoiceNumber"
              value={form.invoiceNumber ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  invoiceNumber: e.target.value,
                }))
              }
            />
            <Input
              label="Fällig am"
              name="dueDate"
              type="date"
              value={form.dueDate ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dueDate: e.target.value }))
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
          title="Ausgaben konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Keine Ausgaben"
          description="Erfassen Sie projektbezogene oder allgemeine Ausgaben."
          actionLabel={canWrite ? 'Neue Ausgabe' : undefined}
          onAction={
            canWrite
              ? () => {
                  setShowForm(true);
                  setForm({ ...emptyForm, projectId: projectFilter });
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
                  <th className="px-3 py-2 font-medium">Beschreibung</th>
                  {!projectFilter ? (
                    <th className="px-3 py-2 font-medium">Projekt</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Brutto</th>
                  <th className="px-3 py-2 font-medium">Fällig</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      {expense.expenseNumber}
                    </td>
                    <td className="px-3 py-3">{expense.description}</td>
                    {!projectFilter ? (
                      <td className="px-3 py-3">
                        {expense.project ? (
                          <Link
                            className="text-[var(--color-brand)] hover:underline"
                            to={`/projects/${expense.project.id}?tab=expenses`}
                          >
                            {expense.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      {BUDGET_CATEGORY_LABELS[expense.category]}
                    </td>
                    <td className="px-3 py-3">
                      <ExpenseStatusBadge status={expense.status} />
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(expense.grossAmount)}
                    </td>
                    <td className="px-3 py-3">
                      {formatDateDe(expense.dueDate)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canApprove &&
                        (expense.status === 'DRAFT' ||
                          expense.status === 'PENDING') ? (
                          <button
                            type="button"
                            className="text-[var(--color-brand)] hover:underline"
                            onClick={() => approveMutation.mutate(expense.id)}
                          >
                            Freigeben
                          </button>
                        ) : null}
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-[var(--color-danger)] hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Ausgabe „${expense.expenseNumber}“ löschen?`,
                                )
                              ) {
                                deleteMutation.mutate(expense.id);
                              }
                            }}
                          >
                            Löschen
                          </button>
                        ) : null}
                      </div>
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
            Ausgaben für dieses Projekt
          </p>
          <div className="flex gap-2">
            <Link to={`/expenses?projectId=${projectFilter}`}>
              <Button variant="secondary" size="sm">
                Alle anzeigen
              </Button>
            </Link>
            {canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setForm({ ...emptyForm, projectId: projectFilter });
                  setShowForm(true);
                  setFormError(null);
                }}
              >
                Neue Ausgabe
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
        title="Ausgaben"
        description="Projekt- und Unternehmensausgaben mit Freigabe."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setForm({ ...emptyForm, projectId: projectFilter });
                setShowForm(true);
                setFormError(null);
              }}
            >
              Neue Ausgabe
            </Button>
          ) : null
        }
      />
      {content}
    </div>
  );
}
