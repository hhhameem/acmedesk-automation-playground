import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter + page state for list pages, kept in the URL so it survives reloads,
 * can be shared as a link, and is restored by Back/Forward.
 *
 *   const list = useListParams(['q', 'status'] as const);
 *   list.values.status        // '' when unset
 *   list.setFilter('status', 'open')   // new history entry, back to page 1
 *   list.setSearch('printer')         // replaces the entry: no history spam while typing
 *   list.setPage(3)
 *
 * Pass a module-level constant for `keys` so its identity is stable.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>,
    [params, keys],
  );

  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, replace: boolean) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  /** Set (or clear, with '') a filter and go back to the first page. */
  const setFilter = useCallback(
    (key: K, value: string) =>
      update((next) => {
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
      }, false),
    [update],
  );

  /** Update the free-text search. Replaces the history entry while typing. */
  const setSearch = useCallback(
    (value: string) =>
      update((next) => {
        if (value) next.set('q', value);
        else next.delete('q');
        next.delete('page');
      }, true),
    [update],
  );

  const setPage = useCallback(
    (n: number, options: { replace?: boolean } = {}) =>
      update((next) => {
        if (n > 1) next.set('page', String(n));
        else next.delete('page');
      }, options.replace ?? false),
    [update],
  );

  return { values, page, setFilter, setSearch, setPage };
}
