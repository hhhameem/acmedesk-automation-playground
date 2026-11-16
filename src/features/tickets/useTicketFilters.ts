import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TicketStatus } from '@/lib/domain';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];

export type TicketView = 'table' | 'board';
export type SortField = 'ref' | 'updatedAt';

/**
 * Ticket list state (filters, sort, page, view), kept in the URL so Back/Forward,
 * reloads and shared links restore it exactly.
 */
export function useTicketFilters() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const statuses = params.getAll('status') as TicketStatus[];
  const priority = params.get('priority') ?? '';
  const category = params.get('category') ?? '';
  const assignee = params.get('assignee') ?? '';
  const sort = params.get('sort') ?? 'updatedAt';
  const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const view: TicketView = params.get('view') === 'board' ? 'board' : 'table';
  const statusKey = statuses.join(',');

  /** API query. The table uses the page size from Settings; the board shows up to 100 cards. */
  const queryParams = useMemo(
    () => ({
      q,
      status: statuses,
      priority,
      category,
      assignee,
      sort,
      dir,
      page,
      ...(view === 'board' ? { pageSize: 100 } : {}),
    }),
    // statuses is a fresh array each render; statusKey captures its value.
    [q, statusKey, priority, category, assignee, sort, dir, page, view],
  );

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace },
      ),
    [setParams],
  );

  const setFilter = useCallback(
    (key: 'priority' | 'category' | 'assignee' | 'view', value: string) =>
      update((p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        p.delete('page');
      }),
    [update],
  );

  /** Typing replaces the current history entry, so Back leaves the page in one step. */
  const setSearch = useCallback(
    (value: string) =>
      update((p) => {
        if (value) p.set('q', value);
        else p.delete('q');
        p.delete('page');
      }, true),
    [update],
  );

  const toggleStatus = useCallback(
    (status: TicketStatus) =>
      update((p) => {
        const current = p.getAll('status');
        p.delete('status');
        const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
        next.forEach((s) => p.append('status', s));
        p.delete('page');
      }),
    [update],
  );

  const toggleSort = useCallback(
    (field: SortField) =>
      update((p) => {
        if (p.get('sort') === field) {
          p.set('dir', p.get('dir') === 'asc' ? 'desc' : 'asc');
        } else {
          p.set('sort', field);
          p.set('dir', 'desc');
        }
      }),
    [update],
  );

  const setPage = useCallback(
    (n: number) =>
      update((p) => {
        if (n > 1) p.set('page', String(n));
        else p.delete('page');
      }),
    [update],
  );

  /** Replace every filter with a saved view's query string. */
  const applyQuery = useCallback((query: string) => setParams(new URLSearchParams(query)), [setParams]);

  /** Filters only (no paging/sort/view), for the CSV export. */
  const exportQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    statuses.forEach((s) => p.append('status', s));
    if (priority) p.set('priority', priority);
    if (category) p.set('category', category);
    if (assignee) p.set('assignee', assignee);
    return p.toString();
  }, [q, statusKey, priority, category, assignee]);

  return {
    values: { q, statuses, priority, category, assignee, sort, dir, page, view },
    /** The full current query string (used by saved views). */
    currentQuery: params.toString(),
    queryParams,
    exportQuery,
    setFilter,
    setSearch,
    toggleStatus,
    toggleSort,
    setPage,
    applyQuery,
  };
}
