import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  roleHasPermission,
  SUBCONTRACTOR_TRADES,
  SUBCONTRACTOR_TRADE_LABELS,
  type SubcontractorTrade,
} from '@fbm/shared';
import { InvoiceStatusBadge } from '../components/finance/StatusBadges';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyValue } from '../components/ui/CurrencyValue';
import {
  dataTableHeadClassName,
  dataTableRowClassName,
  dataTableTdClassName,
  dataTableThClassName,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { formatDateDe } from '../lib/format';
import {
  assignSubcontractorProject,
  fetchSubcontractor,
  unassignSubcontractorProject,
  updateSubcontractor,
  type SubcontractorInput,
} from '../services/partners';
import { fetchProjects } from '../services/projects';

const tradeOptions = SUBCONTRACTOR_TRADES.map((trade) => ({
  value: trade,
  label: SUBCONTRACTOR_TRADE_LABELS[trade],
}));

export function SubcontractorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user
    ? roleHasPermission(user.role, 'subcontractors:write')
    : false;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SubcontractorInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignContractValue, setAssignContractValue] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => fetchSubcontractor(id),
    enabled: Boolean(id),
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'assign-options'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: canWrite,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      companyName: query.data.companyName,
      contactPerson: query.data.contactPerson ?? '',
      trade: query.data.trade,
      email: query.data.email ?? '',
      phone: query.data.phone ?? '',
      street: query.data.street ?? '',
      postalCode: query.data.postalCode ?? '',
      city: query.data.city ?? '',
      country: query.data.country,
      vatId: query.data.vatId ?? '',
      taxNumber: query.data.taxNumber ?? '',
      contractValue: query.data.contractValue,
      notes: query.data.notes ?? '',
    });
  }, [query.data]);

  const assignedProjectIds = useMemo(
    () => new Set(query.data?.projects.map((link) => link.project.id) ?? []),
    [query.data],
  );

  const projectOptions = useMemo(
    () =>
      (projectsQuery.data?.data ?? [])
        .filter((project) => !assignedProjectIds.has(project.id))
        .map((project) => ({
          value: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        })),
    [projectsQuery.data, assignedProjectIds],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Form not ready');
      const payload: Partial<SubcontractorInput> = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson?.trim() || undefined,
        trade: form.trade,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        street: form.street?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'DE',
        vatId: form.vatId?.trim() || undefined,
        taxNumber: form.taxNumber?.trim() || undefined,
        contractValue: form.contractValue?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      return updateSubcontractor(id, payload);
    },
    onSuccess: async () => {
      setEditing(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
      await queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Save failed');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignProjectId) throw new Error('Project required');
      return assignSubcontractorProject(id, {
        projectId: assignProjectId,
        contractValue: assignContractValue.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setAssignProjectId('');
      setAssignContractValue('');
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
    },
    onError: (error) => {
      setAssignError(
        error instanceof ApiError ? error.message : 'Assignment failed',
      );
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (projectId: string) =>
      unassignSubcontractorProject(id, projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
    },
  });

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
        title="Could not load subcontractor"
        description={
          query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'
        }
        actionLabel="Back to subcontractors"
        onAction={() => navigate('/subcontractors')}
      />
    );
  }

  const row = query.data;
  const address = [
    row.street,
    [row.postalCode, row.city].filter(Boolean).join(' '),
    row.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.companyName}
        description={`${SUBCONTRACTOR_TRADE_LABELS[row.trade]} · Subcontractor details`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/subcontractors">
              <Button variant="secondary">All subcontractors</Button>
            </Link>
            {canWrite ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  setFormError(null);
                }}
              >
                {editing ? 'Close editing' : 'Edit'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total invoices"
          value={
            <CurrencyValue value={row.totals.totalPurchases} size="md" />
          }
        />
        <StatCard
          label="Paid"
          value={<CurrencyValue value={row.totals.paidAmount} size="md" />}
        />
        <StatCard
          label="Outstanding"
          value={
            <CurrencyValue
              value={row.totals.outstandingBalance}
              size="md"
            />
          }
        />
        <StatCard
          label="Assigned contract value"
          value={
            <CurrencyValue
              value={row.totals.assignedContractValue ?? row.contractValue}
              size="md"
            />
          }
        />
      </div>

      {editing && canWrite && form ? (
        <Card title="Edit subcontractor">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Company Name"
              name="companyName"
              required
              value={form.companyName}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, companyName: e.target.value } : prev,
                )
              }
            />
            <Select
              label="Trade"
              name="trade"
              required
              value={form.trade}
              options={tradeOptions}
              onChange={(e) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, trade: e.target.value as SubcontractorTrade }
                    : prev,
                )
              }
            />
            <Input
              label="Contact Person"
              name="contactPerson"
              value={form.contactPerson ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contactPerson: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Contract Value"
              name="contractValue"
              value={form.contractValue ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, contractValue: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, email: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Phone"
              name="phone"
              value={form.phone ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, phone: e.target.value } : prev,
                )
              }
            />
            <Input
              label="Street"
              name="street"
              value={form.street ?? ''}
              onChange={(e) =>
                setForm((prev) =>
                  prev ? { ...prev, street: e.target.value } : prev,
                )
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Postal Code"
                name="postalCode"
                value={form.postalCode ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, postalCode: e.target.value } : prev,
                  )
                }
              />
              <Input
                label="City"
                name="city"
                value={form.city ?? ''}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, city: e.target.value } : prev,
                  )
                }
              />
            </div>
            {formError ? (
              <Alert tone="danger" className="md:col-span-2">
                {formError}
              </Alert>
            ) : null}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Contact">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">Trade</dt>
              <dd className="font-medium">
                {SUBCONTRACTOR_TRADE_LABELS[row.trade]}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Contact person</dt>
              <dd>{row.contactPerson ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{row.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd>{row.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Address</dt>
              <dd>{address || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Contract">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">Framework contract value</dt>
              <dd className="font-medium">
                <CurrencyValue value={row.contractValue} size="sm" />
              </dd>
            </div>
            <div>
              <dt className="text-muted">VAT ID</dt>
              <dd>{row.vatId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Tax number</dt>
              <dd>{row.taxNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Notes</dt>
              <dd className="whitespace-pre-wrap">{row.notes ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Assigned projects">
          {canWrite ? (
            <form
              className="mb-4 grid gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
            >
              <Select
                label="Project"
                name="projectId"
                required
                value={assignProjectId}
                placeholder="Select project"
                options={projectOptions}
                onChange={(e) => setAssignProjectId(e.target.value)}
              />
              <Input
                label="Contract Value (optional)"
                name="assignContractValue"
                value={assignContractValue}
                onChange={(e) => setAssignContractValue(e.target.value)}
              />
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={assignMutation.isPending || !assignProjectId}
                >
                  Assign
                </Button>
              </div>
              {assignError ? (
                <Alert tone="danger" className="md:col-span-3">
                  {assignError}
                </Alert>
              ) : null}
            </form>
          ) : null}

          {row.projects.length === 0 ? (
            <p className="text-sm text-muted">No projects assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Project</th>
                    <th className={dataTableThClassName('right')}>
                      Contract value
                    </th>
                    <th className={dataTableThClassName()}>Notes</th>
                    {canWrite ? (
                      <th className={dataTableThClassName()}>Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {row.projects.map((link) => (
                    <tr key={link.id} className={dataTableRowClassName()}>
                      <td className={`${dataTableTdClassName()} font-medium`}>
                        <Link
                          className="text-brand hover:underline"
                          to={`/projects/${link.project.id}`}
                        >
                          {link.project.projectNumber} · {link.project.name}
                        </Link>
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue value={link.contractValue} size="sm" />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {link.notes ?? '—'}
                      </td>
                      {canWrite ? (
                        <td className={dataTableTdClassName()}>
                          <button
                            type="button"
                            className="text-danger hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove assignment to “${link.project.projectNumber}”?`,
                                )
                              ) {
                                unassignMutation.mutate(link.project.id);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Invoices" padding="none">
          {row.invoices.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              No invoices assigned.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={dataTableHeadClassName()}>
                  <tr>
                    <th className={dataTableThClassName()}>Number</th>
                    <th className={dataTableThClassName()}>Status</th>
                    <th className={dataTableThClassName()}>Date</th>
                    <th className={dataTableThClassName('right')}>Gross</th>
                    <th className={dataTableThClassName()}>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {row.invoices.map((invoice) => (
                    <tr key={invoice.id} className={dataTableRowClassName()}>
                      <td className={`${dataTableTdClassName()} font-medium`}>
                        <Link
                          className="text-brand hover:underline"
                          to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className={dataTableTdClassName()}>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {formatDateDe(invoice.issueDate)}
                      </td>
                      <td className={dataTableTdClassName('right')}>
                        <CurrencyValue value={invoice.grossAmount} size="sm" />
                      </td>
                      <td className={dataTableTdClassName()}>
                        {invoice.project ? (
                          <Link
                            className="text-brand hover:underline"
                            to={`/projects/${invoice.project.id}`}
                          >
                            {invoice.project.projectNumber}
                          </Link>
                        ) : (
                          '—'
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
    </div>
  );
}
