import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { ListSkeleton } from '@/components/Skeleton';
import { relativeTime } from '@/lib/format';
import type { Notification } from '@/lib/domain';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<Notification[]>('/api/notifications'),
    refetchInterval: 20_000,
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/api/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = data.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="notification-bell"
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            data-testid="notification-count"
            className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute end-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-brand-400"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || isLoading || data.every((n) => n.read)}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          {isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={3} label="Loading notifications…" />
            </div>
          ) : isError ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400" data-testid="notification-error">
              Couldn't load notifications.{' '}
              <button type="button" className="font-semibold text-brand-600 underline dark:text-brand-400" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : data.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400" data-testid="notification-empty">
              You're all caught up.
            </p>
          ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {data.map((n) => (
              <li
                key={n.id}
                data-unread={n.read ? 'false' : 'true'}
                className={`border-s-2 px-4 py-3 text-sm ${
                  n.read
                    ? 'border-transparent'
                    : 'border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-900/30'
                }`}
              >
                <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{relativeTime(n.time)}</p>
              </li>
            ))}
          </ul>
          )}
        </div>
      )}
    </div>
  );
}
