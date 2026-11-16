// Storage-agnostic transaction helpers over an in-memory Dataset.
//
// Writes are copy-on-write: a draft gets fresh arrays for any collection it
// touches and updated records are new objects, so if a write callback throws
// half-way the committed dataset is untouched, and objects already handed out
// (e.g. cached responses) are never mutated in place.

import type { CollectionName, Dataset, ReadTx, RecordOf, WriteTx } from './types';

type WithId = { id: string };

export function createReadTx(data: Dataset): ReadTx {
  return {
    all: (name) => data[name],
    get: (name, id) => (data[name] as WithId[]).find((r) => r.id === id) as never,
    find: (name, predicate) => (data[name] as never[]).find(predicate as never),
    filter: (name, predicate) => (data[name] as never[]).filter(predicate as never),
  };
}

/** A write transaction over `base`. Call `commit()` to get the resulting dataset. */
export function createWriteTx(base: Dataset): { tx: WriteTx; commit: () => { data: Dataset; changed: boolean } } {
  const draft: Dataset = { ...base };
  const touched = new Set<CollectionName>();

  // Give a collection its own array the first time this transaction writes to it.
  const writable = <K extends CollectionName>(name: K): RecordOf<K>[] => {
    if (!touched.has(name)) {
      (draft as Record<CollectionName, unknown[]>)[name] = [...base[name]];
      touched.add(name);
    }
    return draft[name] as RecordOf<K>[];
  };

  const read = createReadTx(draft);

  const tx: WriteTx = {
    ...read,
    // Re-bind reads to the draft so they see this transaction's own writes.
    all: (name) => draft[name],
    get: (name, id) => (draft[name] as WithId[]).find((r) => r.id === id) as never,
    find: (name, predicate) => (draft[name] as never[]).find(predicate as never),
    filter: (name, predicate) => (draft[name] as never[]).filter(predicate as never),

    insert(name, record, options) {
      const list = writable(name);
      if (options?.at === 'start') list.unshift(record);
      else list.push(record);
      return record;
    },

    update(name, id, patch) {
      // Look before copying, so a miss doesn't count as a change.
      if (!(draft[name] as WithId[]).some((r) => r.id === id)) return undefined;
      const list = writable(name) as unknown as WithId[];
      const idx = list.findIndex((r) => r.id === id);
      // The id is the record's identity and can never be changed by a patch.
      const next = { ...list[idx], ...patch, id: list[idx].id };
      list[idx] = next;
      return next as never;
    },

    remove(name, id) {
      if (!(draft[name] as WithId[]).some((r) => r.id === id)) return false;
      const list = writable(name) as unknown as WithId[];
      const idx = list.findIndex((r) => r.id === id);
      list.splice(idx, 1);
      return true;
    },

    removeWhere(name, predicate) {
      const kept = (draft[name] as never[]).filter((r) => !(predicate as (x: unknown) => boolean)(r));
      const removed = draft[name].length - kept.length;
      if (removed > 0) {
        (draft as Record<CollectionName, unknown[]>)[name] = kept;
        touched.add(name);
      }
      return removed;
    },
  };

  return { tx, commit: () => ({ data: draft, changed: touched.size > 0 }) };
}
