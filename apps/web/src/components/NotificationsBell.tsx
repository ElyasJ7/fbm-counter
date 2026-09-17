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
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Benachrichtigungen"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              Benachrichtigungen
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={unread === 0 || markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              Alle lesen
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
                  title="Keine Meldungen"
                  description="Neue Ereignisse erscheinen hier."
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {listQuery.data?.data.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-3 py-3 text-left hover:bg-slate-50',
                        !item.readAt && 'bg-[var(--color-brand-soft)]/40',
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
                        <p className="text-sm font-medium text-[var(--color-ink)]">
                          {item.title}
                        </p>
                        {!item.readAt ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                        {formatDateDe(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-3 py-2">
            <Link
              to="/notifications"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
              onClick={() => setOpen(false)}
            >
              Alle anzeigen
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
