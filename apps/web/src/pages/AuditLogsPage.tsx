import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { roleHasPermission, type AuditLogDto } from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  DataTable,
  dataTableHeadClassName,
  dataTableRowClassName,
  dataTableTdClassName,
  dataTableThClassName,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterBar } from '../components/ui/FilterBar';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { formatDateDe } from '../lib/format';
import {
  fetchAuditEntityTypes,
  fetchAuditLog,
  fetchAuditLogs,
} from '../services/audit';

function formatActor(actor: AuditLogDto['actor']) {
  if (!actor) return 'System';
  return `${actor.firstName} ${actor.lastName}`;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return (
      <div>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </p>
        <p className="mt-1 text-sm text-muted">—</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-background p-3 text-xs text-ink">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditLogsPage() {
  const { user } = useAuth();
  const canRead = user ? roleHasPermission(user.role, 'audit:read') : false;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedEntityType, setAppliedEntityType] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const typesQuery = useQuery({
    queryKey: ['audit', 'entity-types'],
    queryFn: fetchAuditEntityTypes,
    enabled: canRead,
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: [
      'audit',
      'list',
      page,
      appliedSearch,
      appliedEntityType,
      appliedFrom,
      appliedTo,
    ],
    queryFn: () =>
      fetchAuditLogs({
        page,
        pageSize: 25,
        search: appliedSearch || undefined,
        entityType: appliedEntityType || undefined,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
      }),
    enabled: canRead,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ['audit', 'detail', selectedId],
    queryFn: () => fetchAuditLog(selectedId!),
    enabled: canRead && Boolean(selectedId),
    retry: false,
  });

  const entityOptions = useMemo(
    () => [
      { value: '', label: 'All entity types' },
      ...(typesQuery.data?.data ?? []).map((type) => ({
        value: type,
        label: type,
      })),
    ],
    [typesQuery.data?.data],
  );

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Audit"
          description="Security and change history."
        />
        <EmptyState
          title="No access"
          description="Audit logs are only visible to administrators."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        description="Security and change history."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search.trim());
          setAppliedEntityType(entityType);
          setAppliedFrom(from);
          setAppliedTo(to);
          setPage(1);
        }}
      >
        <FilterBar>
          <Input
            label="Search"
            name="search"
            value={search}
            placeholder="Action, email, entity ID…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Entity type"
            name="entityType"
            value={entityType}
            options={entityOptions}
            onChange={(e) => setEntityType(e.target.value)}
          />
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
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit">Apply</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setEntityType('');
                setFrom('');
                setTo('');
                setAppliedSearch('');
                setAppliedEntityType('');
                setAppliedFrom('');
                setAppliedTo('');
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </FilterBar>
      </form>

      {listQuery.isLoading ? (
        <div className="grid gap-3">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
        </div>
      ) : null}

      {listQuery.error ? (
        <Alert tone="danger" title="Could not load audit logs">
          {listQuery.error instanceof ApiError
            ? listQuery.error.message
            : 'Unexpected error'}
        </Alert>
      ) : null}

      {listQuery.data && listQuery.data.data.length === 0 ? (
        <EmptyState
          title="No entries"
          description="No audit events match the selected filters."
        />
      ) : null}

      {listQuery.data && listQuery.data.data.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <DataTable
            footer={
              <>
                <span>
                  Page {listQuery.data.meta.page} of{' '}
                  {listQuery.data.meta.totalPages} ({listQuery.data.meta.total}{' '}
                  total)
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
                    disabled={page >= listQuery.data.meta.totalPages}
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
                  <th className={dataTableThClassName()}>Time</th>
                  <th className={dataTableThClassName()}>Action</th>
                  <th className={dataTableThClassName()}>Entity</th>
                  <th className={dataTableThClassName()}>User</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.data.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      dataTableRowClassName(),
                      'cursor-pointer',
                      selectedId === row.id && 'bg-brand-soft/50',
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td
                      className={`${dataTableTdClassName()} whitespace-nowrap`}
                    >
                      {formatDateDe(row.createdAt)}
                    </td>
                    <td className={`${dataTableTdClassName()} font-medium`}>
                      {row.action}
                    </td>
                    <td className={dataTableTdClassName()}>
                      <div>{row.entityType}</div>
                      <div className="truncate text-xs text-muted">
                        {row.entityId ?? '—'}
                      </div>
                    </td>
                    <td className={dataTableTdClassName()}>
                      <div>{formatActor(row.actor)}</div>
                      {row.actor?.email ? (
                        <div className="truncate text-xs text-muted">
                          {row.actor.email}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>

          <Card
            title="Details"
            description={
              selectedId
                ? 'Before/after values and metadata'
                : 'Select an entry in the list'
            }
          >
            {!selectedId ? (
              <p className="text-sm text-muted">
                Click a row to view details.
              </p>
            ) : detailQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : detailQuery.error ? (
              <Alert tone="danger" title="Details unavailable">
                {detailQuery.error instanceof ApiError
                  ? detailQuery.error.message
                  : 'Unexpected error'}
              </Alert>
            ) : detailQuery.data ? (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <p>
                    <span className="text-muted">Action: </span>
                    {detailQuery.data.action}
                  </p>
                  <p>
                    <span className="text-muted">Entity: </span>
                    {detailQuery.data.entityType}
                    {detailQuery.data.entityId
                      ? ` · ${detailQuery.data.entityId}`
                      : ''}
                  </p>
                  <p>
                    <span className="text-muted">User: </span>
                    {formatActor(detailQuery.data.actor)}
                    {detailQuery.data.actor?.email
                      ? ` (${detailQuery.data.actor.email})`
                      : ''}
                  </p>
                  <p>
                    <span className="text-muted">Time: </span>
                    {formatDateDe(detailQuery.data.createdAt)}
                  </p>
                  {detailQuery.data.ipAddress ? (
                    <p>
                      <span className="text-muted">IP: </span>
                      {detailQuery.data.ipAddress}
                    </p>
                  ) : null}
                </div>
                <JsonBlock
                  label="Before"
                  value={detailQuery.data.previousValue}
                />
                <JsonBlock label="After" value={detailQuery.data.newValue} />
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
