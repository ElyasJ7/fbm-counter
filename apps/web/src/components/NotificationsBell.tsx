import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Spinner } from './ui/Spinner';
import { cn } from '../lib/cn';
import { formatDateDe } from '../lib/format';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications';

export function NotificationsBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const countQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 30_000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: () => fetchNotifications({ page: 1, pageSize: 8 }),
    enabled: open,
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

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const unread = countQuery.data?.count ?? 0;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          'relative rounded-[var(--radius-md)] p-2 text-muted transition',
          'hover:bg-background hover:text-ink',
          open && 'bg-background text-ink',
        )}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <Button
              size="sm"
              variant="ghost"
              disabled={unread === 0 || markAllMutation.isPending}
              loading={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Mark all read
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (listQuery.data?.data.length ?? 0) === 0 ? (
              <div className="p-3">
                <EmptyState
                  title="No notifications"
                  description="New events will appear here."
                  className="border-0 p-4 shadow-none"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {listQuery.data?.data.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-3 py-3 text-left transition hover:bg-background',
                        !item.readAt && 'bg-brand-soft/50',
                      )}
                      onClick={() => {
                        if (!item.readAt) {
                          markReadMutation.mutate(item.id);
                        }
                        setOpen(false);
                        if (item.link) {
                          navigate(item.link);
                        } else {
                          navigate('/notifications');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {item.type ? (
                            <p className="text-[10px] font-semibold tracking-wider text-subtle uppercase">
                              {item.type}
                            </p>
                          ) : null}
                          <p className="text-sm font-medium text-ink">
                            {item.title}
                          </p>
                        </div>
                        {!item.readAt ? (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                            aria-label="Unread"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[11px] text-subtle">
                        {formatDateDe(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-3 py-2.5">
            <Link
              to="/notifications"
              className="text-sm font-medium text-brand hover:underline"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
