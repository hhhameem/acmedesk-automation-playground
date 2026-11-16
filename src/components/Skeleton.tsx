import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Placeholder shapes shown while data loads. Every page-level skeleton:
//   * keeps `data-testid="loading"` (documented selector) plus a specific one,
//   * is announced to assistive tech once (role="status" + aria-busy), and
//   * roughly matches the layout that replaces it, so nothing jumps.

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-slate-200 dark:bg-slate-800', className)} />;
}

function LoadingRegion({
  label,
  testId,
  className,
  children,
}: {
  label: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="loading"
      data-skeleton={testId}
      className={cn('motion-reduce:[&_*]:animate-none', className)}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Varying widths make the placeholder read as text rather than a grid of bars.
const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5', 'w-3/5'];

/** Rows of a data table, with a header row. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  label = 'Loading…',
  className,
}: {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}) {
  return (
    <LoadingRegion label={label} testId="table" className={cn('overflow-hidden', className)}>
      <div className="flex gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-[6rem]')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-slate-800/60">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={cn('flex-1', c === 0 && 'max-w-[6rem]')}>
              <Skeleton className={cn('h-3.5', WIDTHS[(r + c) % WIDTHS.length])} />
            </div>
          ))}
        </div>
      ))}
    </LoadingRegion>
  );
}

/** A vertical list (activity feed, notifications, comments). */
export function ListSkeleton({ rows = 5, label = 'Loading…', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <LoadingRegion label={label} testId="list" className={cn('space-y-3', className)}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className={cn('h-3', WIDTHS[r % WIDTHS.length])} />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

/** A detail page: title block, a main card with text, and a side card of fields. */
export function DetailSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <LoadingRegion label={label} testId="detail" className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3 max-w-lg" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={cn('h-3', WIDTHS[i % WIDTHS.length])} />
          ))}
          <div className="pt-3">
            <ListSkeletonRows rows={3} />
          </div>
        </div>
        <div className="card space-y-4 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className={cn('h-3.5', WIDTHS[(i + 2) % WIDTHS.length])} />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

function ListSkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <Skeleton className={cn('h-3', WIDTHS[(r + 1) % WIDTHS.length])} />
        </div>
      ))}
    </div>
  );
}

const BAR_HEIGHTS = [40, 65, 50, 80, 35, 70, 55, 90, 45, 60];

/** Dashboard: a row of KPI cards and two chart panels. */
export function DashboardSkeleton({ label = 'Loading dashboard…' }: { label?: string }) {
  return (
    <LoadingRegion label={label} testId="dashboard" className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5">
            <Skeleton className="mb-4 h-4 w-40" />
            <div className="flex h-48 items-end gap-2">
              {BAR_HEIGHTS.map((h, j) => (
                <span
                  key={j}
                  aria-hidden="true"
                  className="block flex-1 animate-pulse rounded-t-md bg-slate-200 dark:bg-slate-800"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Generic page placeholder while a route's code is loading. */
export function PageSkeleton({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div className={cn(fullscreen && 'min-h-screen bg-slate-100 p-6 dark:bg-slate-950')}>
      <LoadingRegion label="Loading page…" testId="page" className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-80 max-w-full" />
        <div className="card overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <div key={r} className="flex gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-slate-800/60">
              {[0, 1, 2, 3].map((c) => (
                <Skeleton key={c} className={cn('h-3.5 flex-1', WIDTHS[(r + c) % WIDTHS.length])} />
              ))}
            </div>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
