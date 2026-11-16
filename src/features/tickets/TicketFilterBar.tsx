import type { ReactNode } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { ASSIGNEES, CATEGORIES, CURRENT_USER, type TicketStatus } from '@/lib/domain';
import { cn } from '@/lib/cn';
import { TICKET_STATUSES, type TicketView } from './useTicketFilters';

interface TicketFilterBarProps {
  q: string;
  statuses: TicketStatus[];
  priority: string;
  category: string;
  assignee: string;
  view: TicketView;
  onSearch: (value: string) => void;
  onFilter: (key: 'priority' | 'category' | 'assignee' | 'view', value: string) => void;
  onToggleStatus: (status: TicketStatus) => void;
  /** Rendered at the bottom of the card (the bulk-selection bar). */
  children?: ReactNode;
}

export function TicketFilterBar({
  q,
  statuses,
  priority,
  category,
  assignee,
  view,
  onSearch,
  onFilter,
  onToggleStatus,
  children,
}: TicketFilterBarProps) {
  return (
    <div className="card p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <input
            className="input"
            placeholder="Search by subject, customer, ref…"
            aria-label="Search tickets"
            data-testid="ticket-search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          aria-label="Filter by priority"
          data-testid="filter-priority"
          value={priority}
          onChange={(e) => onFilter('priority', e.target.value)}
        >
          <option value="">All priorities</option>
          {['low', 'medium', 'high', 'urgent'].map((p) => (
            <option key={p} value={p}>
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Filter by category"
          data-testid="filter-category"
          value={category}
          onChange={(e) => onFilter('category', e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="me-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
        {TICKET_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`status-chip-${s}`}
            onClick={() => onToggleStatus(s)}
            aria-pressed={statuses.includes(s)}
            className={cn(
              'badge border capitalize',
              statuses.includes(s)
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800',
            )}
          >
            {s}
          </button>
        ))}
        <select
          className="input ms-auto max-w-44"
          aria-label="Filter by assignee"
          data-testid="filter-assignee"
          value={assignee}
          onChange={(e) => onFilter('assignee', e.target.value)}
        >
          <option value="">All assignees</option>
          <option value={CURRENT_USER}>{CURRENT_USER} (me)</option>
          {ASSIGNEES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
          {(
            [
              ['table', 'Table view', List],
              ['board', 'Board view', LayoutGrid],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              data-testid={`view-${value}`}
              aria-label={label}
              aria-pressed={view === value}
              onClick={() => onFilter('view', value === 'table' ? '' : value)}
              className={cn(
                'px-2.5 py-2',
                view === value
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300'
                  : 'bg-white dark:bg-slate-800',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
