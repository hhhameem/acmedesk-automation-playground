import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, Download, ExternalLink, Plus, Trash2, UserPlus } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { CURRENT_USER, type Ticket } from '@/lib/domain';
import type { Paginated } from '@/lib/types';
import { downloadFile } from '@/lib/download';
import { toast } from '@/store/toast';
import { ErrorState, EmptyState } from '@/components/States';
import { TableSkeleton } from '@/components/Skeleton';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { DropdownMenu } from '@/components/DropdownMenu';
import { Modal } from '@/components/Modal';
import { KanbanBoard } from '@/features/tickets/KanbanBoard';
import { SavedViews } from '@/features/tickets/SavedViews';
import { BulkBar } from '@/features/tickets/BulkBar';
import { TicketFilterBar } from '@/features/tickets/TicketFilterBar';
import { TicketsTable } from '@/features/tickets/TicketsTable';
import { useTicketFilters } from '@/features/tickets/useTicketFilters';
import { useTicketMutations } from '@/features/tickets/useTicketMutations';

export function Tickets() {
  const filters = useTicketFilters();
  const { q, statuses, priority, category, assignee, sort, dir, view } = filters.values;
  const mutations = useTicketMutations();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ticket: Ticket } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ anchor: DOMRect; ticket: Ticket } | null>(null);
  const [deleted, setDeleted] = useState<{ ref?: string; count: number } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tickets', filters.queryParams],
    queryFn: () => apiGet<Paginated<Ticket>>('/api/tickets', filters.queryParams as never),
    placeholderData: keepPreviousData,
  });
  const items = data?.items ?? [];

  // A selection only applies to the rows on screen, so any change to what's
  // listed clears it.
  const clearSelection = () => setSelected(new Set());
  const withClear =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      fn(...args);
      clearSelection();
    };

  async function exportCsv() {
    try {
      const name = await downloadFile(`/api/tickets/export.csv?${filters.exportQuery}`, 'tickets.csv');
      toast.success({ title: 'Export ready', message: name });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function confirmDelete(t: Ticket) {
    if (!window.confirm(`Delete ticket ${t.ref}? This cannot be undone.`)) return;
    mutations.remove.mutate(t.id, {
      onSuccess: () => {
        setDeleted({ ref: t.ref, count: 1 });
        setSelected((s) => {
          const n = new Set(s);
          n.delete(t.id);
          return n;
        });
      },
    });
  }

  async function bulkDelete() {
    // Only delete rows that are visible on this page.
    const visible = new Set(items.map((t) => t.id));
    const ids = Array.from(selected).filter((id) => visible.has(id));
    if (ids.length === 0 || !window.confirm(`Delete ${ids.length} selected ticket(s)?`)) return;
    setBulkBusy(true);
    try {
      const { deleted: count, failedIds } = await mutations.removeMany(ids);
      if (count > 0) setDeleted({ count });
      // Keep failures selected for a retry; drop the ones that are gone.
      setSelected(new Set(failedIds));
    } finally {
      setBulkBusy(false);
    }
  }

  function ticketItems(t: Ticket): ContextMenuItem[] {
    return [
      {
        label: 'Open in new tab',
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onClick: () => window.open(`/tickets/${t.id}`, '_blank', 'noopener'),
      },
      {
        label: 'Copy ticket link',
        icon: <Copy className="h-3.5 w-3.5" />,
        onClick: () => {
          navigator.clipboard?.writeText(`${window.location.origin}/tickets/${t.id}`);
          toast.info('Link copied to clipboard');
        },
      },
      { label: 'Duplicate', icon: <Copy className="h-3.5 w-3.5" />, onClick: () => mutations.duplicate.mutate(t) },
      {
        label: 'Assign to me',
        icon: <UserPlus className="h-3.5 w-3.5" />,
        onClick: () => mutations.assign.mutate({ id: t.id, assignee: CURRENT_USER }),
      },
      {
        label: 'Mark as resolved',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        onClick: () => mutations.setStatus.mutate({ id: t.id, status: 'resolved' }),
      },
      { label: 'Delete', icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => confirmDelete(t) },
    ];
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" data-testid="page-title">
            Support Tickets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{data ? `${data.total} tickets` : 'Loading…'}</p>
        </div>
        <div className="flex items-center gap-2">
          <SavedViews currentQuery={filters.currentQuery} onApply={withClear(filters.applyQuery)} />
          <button type="button" className="btn-secondary" data-testid="export-tickets" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <Link to="/tickets/new" className="btn-primary" data-testid="new-ticket">
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </div>
      </div>

      <TicketFilterBar
        q={q}
        statuses={statuses}
        priority={priority}
        category={category}
        assignee={assignee}
        view={view}
        onSearch={withClear(filters.setSearch)}
        onFilter={withClear(filters.setFilter)}
        onToggleStatus={withClear(filters.toggleStatus)}
      >
        <BulkBar count={selected.size} busy={bulkBusy} onClear={clearSelection} onDelete={bulkDelete} />
      </TicketFilterBar>

      {isLoading ? (
        <TableSkeleton rows={10} columns={7} label="Loading tickets…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No tickets match your filters" message="Try clearing filters." />
      ) : view === 'board' ? (
        <KanbanBoard tickets={items} onDrop={(id, status) => mutations.setStatus.mutate({ id, status })} />
      ) : (
        <TicketsTable
          items={items}
          selected={selected}
          onSelect={(id, checked) =>
            setSelected((s) => {
              const n = new Set(s);
              if (checked) n.add(id);
              else n.delete(id);
              return n;
            })
          }
          onSelectAll={(checked) => setSelected(checked ? new Set(items.map((t) => t.id)) : new Set())}
          sort={sort}
          dir={dir}
          onSort={withClear(filters.toggleSort)}
          onRowContextMenu={(e, ticket) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, ticket });
          }}
          onRowMenu={(e, ticket) =>
            setRowMenu((current) =>
              current?.ticket.id === ticket.id
                ? null
                : { anchor: (e.currentTarget as HTMLElement).getBoundingClientRect(), ticket },
            )
          }
          pagination={{
            page: data!.page,
            totalPages: data!.totalPages,
            total: data!.total,
            pageSize: data!.pageSize,
            onPageChange: withClear(filters.setPage),
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={ticketItems(contextMenu.ticket)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {rowMenu && (
        <DropdownMenu
          anchor={rowMenu.anchor}
          items={ticketItems(rowMenu.ticket)}
          triggerId={`row-menu-${rowMenu.ticket.ref}`}
          testId={`row-actions-menu-${rowMenu.ticket.ref}`}
          onClose={() => setRowMenu(null)}
        />
      )}

      {deleted && (
        <Modal
          open
          size="sm"
          testId="deleted-modal"
          title="Ticket deleted"
          description={deleted.ref ? `Ticket ${deleted.ref} has been deleted.` : `${deleted.count} ticket(s) have been deleted.`}
          onClose={() => setDeleted(null)}
          footer={
            <button type="button" data-testid="deleted-ok" className="btn-primary" onClick={() => setDeleted(null)}>
              Done
            </button>
          }
        >
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" data-testid="deleted-icon" />
            </span>
            The change is already saved.
          </div>
        </Modal>
      )}
    </div>
  );
}
