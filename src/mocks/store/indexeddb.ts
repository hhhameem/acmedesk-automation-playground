// DataStore backed by IndexedDB, shared by every tab of this origin.
//
//   * The dataset and a small `meta` record ({ seedVersion, rev }) are saved in
//     one IndexedDB object store and always written in one transaction.
//   * Writes are serialized across tabs (Web Lock, or a per-tab queue where Web
//     Locks are unavailable): load anything newer, apply the change
//     copy-on-write, save with rev = max(stored, local) + 1, then broadcast.
//   * Reads first check the stored revision (a tiny read) and reload only when
//     another tab has written something newer, so requests never serve stale
//     data even if a broadcast was missed.
//   * A tab never overwrites data it can't load or that belongs to a different
//     seed version: such writes fail with a "reload" StoreError instead.
//   * If the database is deleted or closed (DevTools "Clear site data",
//     indexedDB.deleteDatabase in a test), the connection is released and
//     reopened on next use; a wiped database means "start from the seed".
//   * If IndexedDB is unavailable (some private-browsing modes), the store runs
//     in memory for this tab only.

import { createReadTx, createWriteTx } from './collections';
import { StoreError, type DataStore, type Dataset } from './types';

interface Meta {
  seedVersion: number;
  rev: number;
  /**
   * Identifies one lifetime of the stored dataset. A new epoch starts when the
   * data is (re)seeded — first run, reset, or after the database was wiped — so
   * tabs reload it even if its rev is lower than the one they remember.
   */
  epoch: string;
}

const newEpoch = () => Math.random().toString(36).slice(2, 10);

export interface IndexedDbStoreOptions {
  /** Builds a fresh copy of the seed data. */
  seed: () => Dataset;
  /** Bump when the seed or the record shapes change; stored data from an older version is replaced. */
  seedVersion: number;
  /** IndexedDB database name. */
  dbName?: string;
}

const STORE = 'state';
const META_KEY = 'meta';
const DATA_KEY = 'db';

const RELOAD_MESSAGE = 'TestDesk was updated in another tab. Reload this page to continue.';

/** Committed arrays are frozen so a stray `.sort()` can't corrupt shared state. */
function freeze(data: Dataset): Dataset {
  for (const list of Object.values(data)) Object.freeze(list);
  return data;
}

export function createIndexedDbStore({ seed, seedVersion, dbName = 'testdesk' }: IndexedDbStoreOptions): DataStore {
  const lockName = `${dbName}-db`;
  const listeners = new Set<() => void>();
  const collectionNames = Object.keys(seed());
  let state: { data: Dataset; rev: number; epoch: string } = { data: freeze(seed()), rev: 0, epoch: '' };
  let idb: IDBDatabase | null = null;
  let memoryOnly = false;
  /** Set when stored data belongs to a newer build: serve the seed, refuse writes. */
  let outdated = false;
  let channel: BroadcastChannel | null = null;
  let initPromise: Promise<void> | null = null;

  // ----- connection --------------------------------------------------------------

  function open(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (db: IDBDatabase | null) => {
        if (!settled) {
          settled = true;
          resolve(db);
        } else {
          db?.close(); // An open that succeeds after we gave up must not leak.
        }
      };
      try {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
          const db = req.result;
          // Let deleteDatabase / upgrades from other code proceed instead of blocking.
          db.onversionchange = () => {
            db.close();
            if (idb === db) idb = null;
          };
          db.onclose = () => {
            if (idb === db) idb = null;
          };
          settle(db);
        };
        req.onerror = () => settle(null);
        req.onblocked = () => settle(null);
      } catch {
        settle(null);
      }
    });
  }

  /** The live connection, reopening it if it was closed. Null in memory-only mode. */
  async function connection(): Promise<IDBDatabase | null> {
    if (memoryOnly) return null;
    if (!idb) idb = await open();
    return idb;
  }

  function get<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  /** Read meta + data in ONE transaction so they always belong together. */
  function getSnapshot(db: IDBDatabase): Promise<{ meta?: Meta; data?: Dataset }> {
    return new Promise((resolve, reject) => {
      const os = db.transaction(STORE, 'readonly').objectStore(STORE);
      const metaReq = os.get(META_KEY);
      const dataReq = os.get(DATA_KEY);
      dataReq.onsuccess = () => resolve({ meta: metaReq.result as Meta | undefined, data: dataReq.result as Dataset | undefined });
      dataReq.onerror = () => reject(dataReq.error);
    });
  }

  /** Write meta + data atomically. Resolves false if the browser refused (e.g. quota). */
  function putSnapshot(db: IDBDatabase, meta: Meta, data: Dataset): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const os = tx.objectStore(STORE);
        os.put(data, DATA_KEY);
        os.put(meta, META_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  // ----- serialization ---------------------------------------------------------

  let localQueue: Promise<unknown> = Promise.resolve();
  /** Run fn exclusively: across tabs with Web Locks, otherwise at least within this tab. */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) return locks.request(lockName, fn) as Promise<T>;
    const run = localQueue.then(fn, fn);
    localQueue = run.catch(() => undefined);
    return run;
  }

  // ----- sync ------------------------------------------------------------------

  function isValidDataset(data: unknown): data is Dataset {
    if (!data || typeof data !== 'object') return false;
    return collectionNames.every((k) => Array.isArray((data as Record<string, unknown>)[k]));
  }

  function emitExternalChange() {
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        // A listener failing must not break the store.
      }
    });
  }

  /**
   * Bring memory up to date with storage (best effort, for reads).
   * Returns true if this tab's data changed.
   */
  async function refresh(): Promise<boolean> {
    if (outdated) return false;
    try {
      const db = await connection();
      if (!db) return false;
      const meta = await get<Meta>(db, META_KEY);
      if (!meta) {
        // The database was wiped (cleared site data / deleteDatabase): start over from the seed.
        if (state.epoch === '') return false;
        state = { data: freeze(seed()), rev: 0, epoch: '' };
        return true;
      }
      if (meta.seedVersion !== seedVersion || !isNewer(meta)) return false;
      const snapshot = await getSnapshot(db);
      // Re-check after the await: another refresh may already have applied something newer.
      if (!snapshot.meta || !isNewer(snapshot.meta) || !isValidDataset(snapshot.data)) return false;
      state = { data: freeze(snapshot.data), rev: snapshot.meta.rev, epoch: snapshot.meta.epoch };
      return true;
    } catch {
      return false;
    }
  }

  /** Stored data replaces ours if it's a different lifetime of the dataset, or a later rev of ours. */
  function isNewer(meta: Meta): boolean {
    return meta.epoch !== state.epoch || meta.rev > state.rev;
  }

  async function refreshAndNotify() {
    if (await refresh()) emitExternalChange();
  }

  /**
   * Inside the write lock: load the latest stored data or explain why we can't.
   * Returns the stored revision (0 if nothing is stored) to base the next rev on.
   */
  async function loadLatestForWrite(db: IDBDatabase): Promise<{ rev: number; epoch: string }> {
    let snapshot: { meta?: Meta; data?: Dataset };
    try {
      snapshot = await getSnapshot(db);
    } catch {
      throw new StoreError('Could not read browser storage');
    }
    const { meta, data } = snapshot;
    if (!meta) {
      // Nothing stored (wiped): this write starts a new lifetime from the seed.
      if (state.epoch !== '') {
        state = { data: freeze(seed()), rev: 0, epoch: '' };
        emitExternalChange();
      }
      return { rev: 0, epoch: newEpoch() };
    }
    if (meta.seedVersion !== seedVersion) throw new StoreError(RELOAD_MESSAGE);
    if (isNewer(meta)) {
      if (!isValidDataset(data)) throw new StoreError('Stored data is unreadable. Reset the demo data in Settings.');
      state = { data: freeze(data), rev: meta.rev, epoch: meta.epoch };
      emitExternalChange();
    }
    return { rev: meta.rev, epoch: meta.epoch };
  }

  async function commit(db: IDBDatabase | null, data: Dataset, baseRev: number, epoch: string) {
    const rev = Math.max(baseRev, state.epoch === epoch ? state.rev : 0) + 1;
    if (db) {
      const saved = await putSnapshot(db, { seedVersion, rev, epoch }, data);
      if (!saved) throw new StoreError('Could not save changes to browser storage');
    }
    state = { data: freeze(data), rev, epoch };
    channel?.postMessage({ rev, epoch });
  }

  // ----- DataStore ---------------------------------------------------------------

  async function doInit() {
    // Listen first, so even the initial seeding below reaches other tabs.
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(lockName);
      channel.onmessage = (e: MessageEvent<{ rev?: number; epoch?: string }>) => {
        if (e.data?.rev !== state.rev || e.data?.epoch !== state.epoch) void refreshAndNotify();
      };
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refreshAndNotify();
      });
    }

    const db = await connection();
    if (!db) {
      memoryOnly = true;
      return;
    }
    await exclusive(async () => {
      try {
        const { meta, data } = await getSnapshot(db);
        if (meta && meta.seedVersion > seedVersion) {
          // Data written by a newer build: don't destroy it. Serve the seed read-only.
          outdated = true;
          return;
        }
        if (meta?.seedVersion === seedVersion && typeof meta.epoch === 'string' && isValidDataset(data)) {
          state = { data: freeze(data), rev: meta.rev, epoch: meta.epoch };
          return;
        }
        // First run, older seed version, or unreadable data: start from the seed.
        await commit(db, seed(), meta?.rev ?? 0, newEpoch());
      } catch {
        memoryOnly = true; // Storage is unusable — fall back to memory for this tab.
        idb?.close();
        idb = null;
      }
    });
  }

  return {
    init() {
      initPromise ??= doInit().catch(() => {
        memoryOnly = true;
      });
      return initPromise;
    },

    async read(fn) {
      if (await refresh()) emitExternalChange();
      return fn(createReadTx(state.data));
    },

    write(fn) {
      if (outdated) return Promise.reject(new StoreError(RELOAD_MESSAGE));
      return exclusive(async () => {
        const db = await connection();
        const base = db ? await loadLatestForWrite(db) : { rev: state.rev, epoch: state.epoch };
        const { tx, commit: finish } = createWriteTx(state.data);
        const result = fn(tx); // throws → nothing committed
        const { data, changed } = finish();
        if (changed) await commit(db, data, base.rev, base.epoch);
        return result;
      });
    },

    reset() {
      if (outdated) return Promise.reject(new StoreError(RELOAD_MESSAGE));
      return exclusive(async () => {
        const db = await connection();
        let storedRev = 0;
        if (db) {
          const meta = await get<Meta>(db, META_KEY).catch(() => undefined);
          storedRev = meta?.rev ?? 0;
        }
        // A reset starts a new lifetime, so every tab reloads it.
        await commit(db, seed(), storedRev, newEpoch());
      });
    },

    onExternalChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
