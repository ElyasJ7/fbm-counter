import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonCard } from '../components/ui/Skeleton';
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
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts and system messages."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={unreadOnly ? 'primary' : 'secondary'}
              onClick={() => {
                setUnreadOnly((value) => !value);
                setPage(1);
              }}
            >
              {unreadOnly ? 'Unread only' : 'All'}
            </Button>
            <Button
              variant="secondary"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
      ) : null}

      {query.error ? (
        <Alert tone="danger" title="Could not load notifications">
          {query.error instanceof ApiError
            ? query.error.message
            : 'Unexpected error'}
        </Alert>
      ) : null}

      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="New events will appear here automatically."
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <Card padding="none">
          <ul className="divide-y divide-border">
            {query.data.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col gap-1 px-4 py-4 text-left transition hover:bg-background/80',
                    !item.readAt && 'bg-brand-soft/30',
                  )}
                  onClick={() => {
                    if (!item.readAt) markReadMutation.mutate(item.id);
                    if (item.link) navigate(item.link);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{item.title}</p>
                    <span className="text-xs text-muted">
                      {formatDateDe(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{item.message}</p>
                  <p className="text-xs text-muted">{item.type}</p>
                </button>
              </li>
            ))}
          </ul>

          {query.data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {query.data.meta.page} of {query.data.meta.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
