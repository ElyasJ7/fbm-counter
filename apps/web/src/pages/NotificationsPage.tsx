import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { formatDateDe } from '../lib/format';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications';

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = useQuery({
    queryKey: ['notifications', 'page', page, unreadOnly],
    queryFn: () =>
      fetchNotifications({ page, pageSize: 20, unreadOnly }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Benachrichtigungen"
        description="Freigaben, überfällige Rechnungen und Dokument-Uploads."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={unreadOnly ? 'primary' : 'secondary'}
              onClick={() => {
                setUnreadOnly((value) => !value);
                setPage(1);
              }}
            >
              {unreadOnly ? 'Nur ungelesen' : 'Alle'}
            </Button>
            <Button
              variant="secondary"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Alle als gelesen
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : null}

      {query.error ? (
        <EmptyState
          title="Benachrichtigungen konnten nicht geladen werden"
          description={
            query.error instanceof ApiError
              ? query.error.message
              : 'Unerwarteter Fehler'
          }
        />
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="Keine Benachrichtigungen"
          description="Neue Ereignisse erscheinen hier automatisch."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {query.data.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-4 text-left hover:bg-slate-50',
                    !item.readAt && 'bg-[var(--color-brand-soft)]/30',
                  )}
                  onClick={() => {
                    if (!item.readAt) markReadMutation.mutate(item.id);
                    if (item.link) navigate(item.link);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--color-ink)]">
                      {item.title}
                    </p>
                    <span className="text-xs text-[var(--color-muted)]">
                      {formatDateDe(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">
                    {item.message}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{item.type}</p>
                </button>
              </li>
            ))}
          </ul>

          {query.data.meta.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Zurück
              </Button>
              <span className="text-sm text-[var(--color-muted)]">
                Seite {query.data.meta.page} von {query.data.meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
