import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  roleHasPermission,
  type ProjectStatus,
} from '@fbm/shared';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { Button } from '../components/ui/Button';
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
import { ProgressBar } from '../components/ui/ProgressBar';
import { Select } from '../components/ui/Select';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { formatDateDe } from '../lib/format';
import {
  fetchCustomers,
  fetchManagers,
  fetchProjects,
} from '../services/projects';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(1);
  const status = (searchParams.get('status') ?? '') as ProjectStatus | '';
  const customerId = searchParams.get('customerId') ?? '';
  const projectManagerId = searchParams.get('projectManagerId') ?? '';

  const query = useQuery({
    queryKey: ['projects', page, search, status, customerId, projectManagerId],
    queryFn: () =>
      fetchProjects({
        page,
        pageSize: 20,
        search,
        status,
        customerId: customerId || undefined,
        projectManagerId: projectManagerId || undefined,
      }),
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'project-filter'],
    queryFn: () => fetchCustomers({ page: 1, pageSize: 100 }),
  });

  const managersQuery = useQuery({
    queryKey: ['managers', 'project-filter'],
    queryFn: fetchManagers,
  });

  const statusOptions = useMemo(
    () =>
      PROJECT_STATUSES.map((value) => ({
        value,
        label: PROJECT_STATUS_LABELS[value],
      })),
    [],
  );

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.companyName,
      })),
    [customersQuery.data],
  );

  const managerOptions = useMemo(
    () =>
      (managersQuery.data ?? []).map((m) => ({
        value: m.id,
        label: `${m.firstName} ${m.lastName}`,
      })),
    [managersQuery.data],
  );

  function patchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage construction projects, budgets, and financial performance."
        actions={
          canWrite ? (
            <Link to="/projects/new">
              <Button>New project</Button>
            </Link>
          ) : null
        }
      />

      <FilterBar>
        <Input
          label="Search"
          name="search"
          value={search}
          placeholder="Number, name, customer…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Status"
          name="status"
          value={status}
          placeholder="All statuses"
          options={statusOptions}
          onChange={(e) => patchParam('status', e.target.value)}
        />
        <Select
          label="Customer"
          name="customerId"
          value={customerId}
          placeholder="All customers"
          options={customerOptions}
          onChange={(e) => patchParam('customerId', e.target.value)}
        />
        <Select
          label="Project manager"
          name="projectManagerId"
          value={projectManagerId}
          placeholder="All managers"
          options={managerOptions}
          onChange={(e) => patchParam('projectManagerId', e.target.value)}
        />
      </FilterBar>

      {query.isLoading ? (
        <div className="grid gap-3">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
        </div>
      ) : null}

      {query.error ? (
        <ErrorState
          title="Could not load projects"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Create a project to start tracking construction finances."
          actionLabel={canWrite ? 'New project' : undefined}
          onAction={
            canWrite ? () => navigate('/projects/new') : undefined
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <DataTable
          aria-label="Projects"
          footer={
            <>
              <span>
                Page {query.data.meta.page} of {query.data.meta.totalPages} (
                {query.data.meta.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= query.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          }
        >
          <table className="min-w-full text-left text-sm">
            <thead className={dataTableHeadClassName()}>
              <tr>
                <th className={dataTableThClassName()}>Number</th>
                <th className={dataTableThClassName()}>Name</th>
                <th className={dataTableThClassName()}>Customer</th>
                <th className={dataTableThClassName()}>Manager</th>
                <th className={dataTableThClassName()}>Status</th>
                <th className={dataTableThClassName('right')}>Contract</th>
                <th className={dataTableThClassName('right')}>Budget</th>
                <th className={dataTableThClassName()}>Progress</th>
                <th className={dataTableThClassName()}>End</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((project) => (
                <tr key={project.id} className={dataTableRowClassName()}>
                  <td className={dataTableTdClassName()}>
                    <Link
                      className="font-medium text-brand hover:underline"
                      to={`/projects/${project.id}`}
                    >
                      {project.projectNumber}
                    </Link>
                  </td>
                  <td className={dataTableTdClassName()}>
                    <Link
                      className="font-medium text-ink hover:underline"
                      to={`/projects/${project.id}`}
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className={cn(dataTableTdClassName(), 'text-muted')}>
                    {project.customer.companyName}
                  </td>
                  <td className={cn(dataTableTdClassName(), 'text-muted')}>
                    {project.projectManager
                      ? `${project.projectManager.firstName} ${project.projectManager.lastName}`
                      : '—'}
                  </td>
                  <td className={dataTableTdClassName()}>
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className={dataTableTdClassName('right')}>
                    <CurrencyValue
                      value={project.contractValue}
                      currency={project.currency}
                      size="sm"
                    />
                  </td>
                  <td className={dataTableTdClassName('right')}>
                    <CurrencyValue
                      value={project.currentBudget}
                      currency={project.currency}
                      size="sm"
                      tone="muted"
                    />
                  </td>
                  <td className={dataTableTdClassName()}>
                    <ProgressBar value={project.progressPercent} />
                  </td>
                  <td className={cn(dataTableTdClassName(), 'text-muted')}>
                    {formatDateDe(project.expectedCompletionDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      ) : null}
    </div>
  );
}
