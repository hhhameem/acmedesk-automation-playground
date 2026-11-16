import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ExternalLink, MoreHorizontal } from 'lucide-react';
import type { Ticket } from '@/lib/domain';
import { relativeTime } from '@/lib/format';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { Pagination } from '@/components/Pagination';
import { Tooltip } from '@/components/Tooltip';
import type { SortField } from './useTicketFilters';

interface TicketsTableProps {
  items: Ticket[];
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  sort: string;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onRowContextMenu: (e: React.MouseEvent, ticket: Ticket) => void;
  onRowMenu: (e: React.MouseEvent, ticket: Ticket) => void;
  pagination: { page: number; totalPages: number; total: number; pageSize: number; onPageChange: (page: number) => void };
}

function SortHeader({
  field,
  label,
  sort,
  dir,
  onSort,
}: {
  field: SortField;
  label: string;
  sort: string;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const active = sort === field;
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-3" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        data-testid={`sort-${field}`}
        className="inline-flex items-center gap-1 uppercase hover:text-brand-600"
      >
        {label}
        {active && <Arrow className="h-3 w-3" aria-hidden="true" />}
      </button>
    </th>
  );
}

export function TicketsTable({
  items,
  selected,
  onSelect,
  onSelectAll,
  sort,
  dir,
  onSort,
  onRowContextMenu,
  onRowMenu,
  pagination,
}: TicketsTableProps) {
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="tickets-table">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  data-testid="select-all"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </th>
              <SortHeader field="ref" label="Ref" sort={sort} dir={dir} onSort={onSort} />
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Priority</th>
              <SortHeader field="updatedAt" label="Updated" sort={sort} dir={dir} onSort={onSort} />
              <th className="w-24 px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((t) => (
              <tr
                key={t.id}
                data-testid={`ticket-row-${t.ref}`}
                onContextMenu={(e) => onRowContextMenu(e, t)}
                className="group hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${t.ref}`}
                    checked={selected.has(t.id)}
                    onChange={(e) => onSelect(t.id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/tickets/${t.id}`}
                    data-testid={`ticket-ref-${t.ref}`}
                    className="font-mono text-xs text-brand-600 hover:text-brand-500 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    {t.ref}
                  </Link>
                </td>
                <td className="max-w-xs px-3 py-2.5">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{t.subject}</span>
                  {t.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {t.tags.map((tag) => (
                        <span key={tag} className="badge bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{t.customerName}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2.5">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="px-3 py-2.5 text-slate-500">{relativeTime(t.updatedAt)}</td>
                <td className="px-3 py-2.5">
                  {/* Hover-only row actions are an intentional practice scenario. */}
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Tooltip label="Open in new tab" align="end" testId={`tooltip-newtab-${t.ref}`}>
                      <a
                        href={`/tickets/${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`open-newtab-${t.ref}`}
                        aria-label={`Open ${t.ref} in new tab`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Tooltip>
                    <Tooltip label="More actions" align="end" testId={`tooltip-more-${t.ref}`}>
                      <button
                        type="button"
                        aria-label={`More actions for ${t.ref}`}
                        aria-haspopup="menu"
                        data-testid={`row-menu-${t.ref}`}
                        onClick={(e) => onRowMenu(e, t)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-3 dark:border-slate-800">
        <Pagination {...pagination} />
      </div>
    </div>
  );
}
