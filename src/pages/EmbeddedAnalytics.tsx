import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { AnalyticsReport } from '@/lib/types';
import { DashboardSkeleton } from '@/components/Skeleton';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Analytics report rendered inside the Dashboard's "Embedded analytics" iframe
 * (/embed/analytics). It is its own document, so automation has to switch
 * into the iframe to read or drive it — none of these test ids exist in the
 * host page's DOM.
 */
export function EmbeddedAnalytics() {
  const [days, setDays] = useState<Range>(30);

  useEffect(() => {
    document.title = 'TestDesk Analytics';
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => apiGet<AnalyticsReport>('/api/analytics', { days }),
    placeholderData: keepPreviousData,
  });

  const maxCategory = Math.max(1, ...(data?.categories.map((c) => c.count) ?? []));

  const kpis = data
    ? [
        { id: 'tickets', label: 'Tickets created', value: formatNumber(data.tickets) },
        { id: 'open', label: 'Open backlog', value: formatNumber(data.open) },
        {
          id: 'resolution',
          label: 'Resolution rate',
          value: data.resolutionRate === null ? '—' : `${data.resolutionRate}%`,
        },
        { id: 'orders', label: 'Orders', value: formatNumber(data.orders) },
        { id: 'revenue', label: 'Revenue', value: formatCurrency(data.revenue) },
      ]
    : [];

  return (
    <div
      className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      data-testid="analytics-root"
      aria-busy={isFetching}
    >
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold" data-testid="analytics-heading">
          Support &amp; Sales Analytics
        </h1>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          embedded
        </span>
        <div
          className="ms-auto flex gap-1 rounded-lg bg-slate-200 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Date range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setDays(r)}
              data-testid={`analytics-range-${r}`}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs',
                days === r
                  ? 'bg-white font-semibold text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {r} days
            </button>
          ))}
        </div>
        <p className="w-full text-xs text-slate-500 dark:text-slate-400">
          TestDesk Insights · <span data-testid="analytics-range-label">Last {days} days</span>
        </p>
      </header>

      {isLoading ? (
        <div data-testid="analytics-loading">
          <DashboardSkeleton label="Loading analytics…" />
        </div>
      ) : isError || !data ? (
        <div className="py-16 text-center text-sm text-slate-500" data-testid="analytics-error">
          Couldn't load analytics.{' '}
          <button type="button" className="font-semibold text-brand-600 underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
          <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.id} className="card px-3 py-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums" data-testid={`analytics-kpi-${k.id}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold">Tickets by category</h2>
              <div data-testid="analytics-category-chart" className="space-y-2">
                {data.categories.length === 0 ? (
                  <p className="text-xs text-slate-500">No tickets in this range.</p>
                ) : (
                  data.categories.map((c) => (
                    <div
                      key={c.name}
                      className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2 text-xs"
                      data-testid={`analytics-category-${slug(c.name)}`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-300"
                          style={{ width: `${(c.count / maxCategory) * 100}%` }}
                        />
                      </span>
                      <span className="text-end tabular-nums text-slate-600 dark:text-slate-300">{c.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold">Orders by channel</h2>
              <table className="w-full text-xs" data-testid="analytics-channel-table">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400">
                    <th className="pb-2 text-start font-medium">Channel</th>
                    <th className="pb-2 text-end font-medium">Orders</th>
                    <th className="pb-2 text-end font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-2 text-slate-500">
                        No orders in this range.
                      </td>
                    </tr>
                  ) : (
                    data.channels.map((ch) => (
                      <tr
                        key={ch.channel}
                        className="border-t border-slate-100 dark:border-slate-800"
                        data-testid={`analytics-channel-${ch.channel}`}
                      >
                        <td className="py-1.5 capitalize">{ch.channel}</td>
                        <td className="py-1.5 text-end tabular-nums">{formatNumber(ch.orders)}</td>
                        <td className="py-1.5 text-end tabular-nums">{formatCurrency(ch.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-3 text-[11px] text-slate-400">
            Last refreshed{' '}
            <span data-testid="analytics-updated">{new Date(data.generatedAt).toLocaleTimeString()}</span>
          </p>
        </div>
      )}
    </div>
  );
}
