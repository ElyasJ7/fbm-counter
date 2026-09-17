import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { roleHasPermission, type AuditLogDto } from '@fbm/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
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
        <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
          {label}
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">—</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {label}
      </p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-[var(--color-border)] bg-slate-50 p-3 text-xs text-[var(--color-ink)]">
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
      { value: '', label: 'Alle Objekte' },
      ...(typesQuery.data?.data ?? []).map((type) => ({
        value: type,
        label: type,
      })),
    ],
    [typesQuery.data?.data],
  );

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Audit-Protokoll"
          description="Unternehmensweite Änderungs- und Zugriffsprotokolle."
        />
        <EmptyState
          title="Kein Zugriff"
          description="Audit-Logs sind nur für Verwaltung und Admins sichtbar."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit-Protokoll"
        description="Alle erfassten Systemänderungen — filterbar nach Objekt, Zeitraum und Suche."
      />

      <Card className="mb-4" title="Filter">
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
            setAppliedEntityType(entityType);
            setAppliedFrom(from);
            setAppliedTo(to);
            setPage(1);
          }}
        >
          <Input
            label="Suche"
            name="search"
            value={search}
            placeholder="Aktion, E-Mail, Objekt-ID…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Objekttyp"
            name="entityType"
            value={entityType}
            options={entityOptions}
            onChange={(e) => setEntityType(e.target.value)}
          />
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
          <div className="flex items-end gap-2">
            <Button type="submit">Anwenden</Button>
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
              Zurücksetzen
            </Button>
          </div>
        </form>
      </Card>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {listQuery.error ? (
        <EmptyState
          title="Audit-Logs konnten nicht geladen werden"
          description={
            listQuery.error instanceof ApiError
              ? listQuery.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {listQuery.data && listQuery.data.data.length === 0 ? (
        <EmptyState
          title="Keine Einträge"
          description="Für den gewählten Filter gibt es keine Audit-Ereignisse."
        />
      ) : null}

      {listQuery.data && listQuery.data.data.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <div className="overflow-x-auto">
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
                  {listQuery.data.data.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50 ${
                        selectedId === row.id
                          ? 'bg-[var(--color-brand-soft)]/50'
                          : ''
                      }`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatDateDe(row.createdAt)}
                      </td>
                      <td className="px-3 py-3 font-medium">{row.action}</td>
                      <td className="px-3 py-3">
                        <div>{row.entityType}</div>
                        <div className="truncate text-xs text-[var(--color-muted)]">
                          {row.entityId ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{formatActor(row.actor)}</div>
                        {row.actor?.email ? (
                          <div className="truncate text-xs text-[var(--color-muted)]">
                            {row.actor.email}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
              <span>
                Seite {listQuery.data.meta.page} von{' '}
                {listQuery.data.meta.totalPages} ({listQuery.data.meta.total}{' '}
                gesamt)
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
                  disabled={page >= listQuery.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Weiter
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Details"
            description={
              selectedId
                ? 'Vorher-/Nachher-Werte und Metadaten'
                : 'Eintrag in der Liste auswählen'
            }
          >
            {!selectedId ? (
              <p className="text-sm text-[var(--color-muted)]">
                Klicken Sie auf eine Zeile, um Details zu sehen.
              </p>
            ) : detailQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : detailQuery.error ? (
              <EmptyState
                title="Details nicht verfügbar"
                description={
                  detailQuery.error instanceof ApiError
                    ? detailQuery.error.message
                    : 'Unerwarteter Fehler'
                }
              />
            ) : detailQuery.data ? (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <p>
                    <span className="text-[var(--color-muted)]">Aktion: </span>
                    {detailQuery.data.action}
                  </p>
                  <p>
                    <span className="text-[var(--color-muted)]">Objekt: </span>
                    {detailQuery.data.entityType}
                    {detailQuery.data.entityId
                      ? ` · ${detailQuery.data.entityId}`
                      : ''}
                  </p>
                  <p>
                    <span className="text-[var(--color-muted)]">Benutzer: </span>
                    {formatActor(detailQuery.data.actor)}
                    {detailQuery.data.actor?.email
                      ? ` (${detailQuery.data.actor.email})`
                      : ''}
                  </p>
                  <p>
                    <span className="text-[var(--color-muted)]">Zeit: </span>
                    {formatDateDe(detailQuery.data.createdAt)}
                  </p>
                  {detailQuery.data.ipAddress ? (
                    <p>
                      <span className="text-[var(--color-muted)]">IP: </span>
                      {detailQuery.data.ipAddress}
                    </p>
                  ) : null}
                </div>
                <JsonBlock
                  label="Vorher"
                  value={detailQuery.data.previousValue}
                />
                <JsonBlock label="Nachher" value={detailQuery.data.newValue} />
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
