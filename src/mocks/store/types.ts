// The data-access contract for the mock backend.
//
// Request handlers talk to data ONLY through a DataStore. Swapping the storage
// engine (IndexedDB today; e.g. localStorage, SQLite-wasm or a remote sync
// service tomorrow) means writing another DataStore implementation and changing
// the single binding in ./index.ts — no handler code changes.

import type {
  Activity,
  Comment,
  Customer,
  Notification,
  Order,
  Product,
  ReturnRequest,
  ShipmentEvent,
  Ticket,
} from '../data';

/** Every collection the backend stores, keyed by name → record type. */
export interface Collections {
  tickets: Ticket;
  customers: Customer;
  products: Product;
  notifications: Notification;
  comments: Comment;
  activity: Activity;
  orders: Order;
  shipments: ShipmentEvent;
  returns: ReturnRequest;
}

export type CollectionName = keyof Collections;

/** A full dataset: one array per collection. */
export type Dataset = { [K in CollectionName]: Collections[K][] };

/** Every record has a string id. */
export type RecordOf<K extends CollectionName> = Collections[K];

/** Read access inside a store.read() / store.write() callback. */
export interface ReadTx {
  /** All records of a collection, in stored order. Do not mutate. */
  all<K extends CollectionName>(name: K): readonly RecordOf<K>[];
  get<K extends CollectionName>(name: K, id: string): RecordOf<K> | undefined;
  find<K extends CollectionName>(name: K, predicate: (r: RecordOf<K>) => boolean): RecordOf<K> | undefined;
  filter<K extends CollectionName>(name: K, predicate: (r: RecordOf<K>) => boolean): RecordOf<K>[];
}

/** Read + write access inside a store.write() callback. */
export interface WriteTx extends ReadTx {
  /** Add a record. `at: 'start'` puts it first (newest-first collections). */
  insert<K extends CollectionName>(name: K, record: RecordOf<K>, options?: { at?: 'start' | 'end' }): RecordOf<K>;
  /** Shallow-merge a patch into the record with this id. Returns the new record, or undefined if missing. */
  update<K extends CollectionName>(name: K, id: string, patch: Partial<RecordOf<K>>): RecordOf<K> | undefined;
  /** Remove the record with this id. Returns whether it existed. */
  remove<K extends CollectionName>(name: K, id: string): boolean;
  /** Remove every matching record. Returns how many were removed. */
  removeWhere<K extends CollectionName>(name: K, predicate: (r: RecordOf<K>) => boolean): number;
}

export interface DataStore {
  /** Load (or seed) the data. Must be awaited once before any read/write. Never throws. */
  init(): Promise<void>;
  /** Run a read against the newest data. */
  read<T>(fn: (tx: ReadTx) => T): Promise<T>;
  /**
   * Run a write atomically: `fn` runs against the newest data; if it throws,
   * nothing is changed. Changes are durable and visible to other tabs once the
   * returned promise resolves.
   */
  write<T>(fn: (tx: WriteTx) => T): Promise<T>;
  /** Replace all data with the seed. */
  reset(): Promise<void>;
  /** Called when data changed outside this tab (another tab, a reset elsewhere). */
  onExternalChange(listener: () => void): () => void;
}

/** Thrown when a write could not be saved. Handlers turn this into a 5xx. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
