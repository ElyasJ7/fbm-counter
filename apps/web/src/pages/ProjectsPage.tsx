import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  roleHasPermission,
  type ProjectStatus,
} from '@fbm/shared';
import { ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
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
import { fetchProjects } from '../services/projects';

export function ProjectsPage() {
  const { user } = useAuth();
  const canWrite = user
    ? roleHasPermission(user.role, 'projects:write')
    : false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(1);
  const status = (searchParams.get('status') ?? '') as ProjectStatus | '';

  const query = useQuery({
    queryKey: ['projects', page, search, status],
    queryFn: () =>
      fetchProjects({
        page,
        pageSize: 20,
        search,
        status,
      }),
  });

  const statusOptions = useMemo(
    () =>
      PROJECT_STATUSES.map((value) => ({
        value,
        label: PROJECT_STATUS_LABELS[value],
      })),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Construction projects with contract value, budget, and status."
        actions={
          <div className="flex gap-2">
            <Link to="/customers">
              <Button variant="secondary">Customers</Button>
            </Link>
            {canWrite ? (
              <Link to="/projects/new">
                <Button>New project</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
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
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('status', e.target.value);
            else next.delete('status');
            setSearchParams(next);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error ? (
        <EmptyState
          title="Could not load projects"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unexpected error'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Create a project to start tracking construction finances."
          actionLabel={canWrite ? 'New project' : undefined}
          onAction={
            canWrite
              ? () => {
                  window.location.href = '/projects/new';
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
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Contract</th>
                  <th className="px-3 py-2 font-medium">Budget</th>
                  <th className="px-3 py-2 font-medium">Progress</th>
                  <th className="px-3 py-2 font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">
                      <Link
                        className="text-[var(--color-brand)] hover:underline"
                        to={`/projects/${project.id}`}
                      >
                        {project.projectNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        className="hover:underline"
                        to={`/projects/${project.id}`}
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {project.customer.companyName}
                    </td>
                    <td className="px-3 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(project.contractValue, project.currency)}
                    </td>
                    <td className="px-3 py-3">
                      {formatCurrency(project.currentBudget, project.currency)}
                    </td>
                    <td className="px-3 py-3">{project.progressPercent}%</td>
                    <td className="px-3 py-3">
                      {formatDateDe(project.expectedCompletionDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
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
          </div>
        </Card>
      ) : null}
    </div>
  );
}
