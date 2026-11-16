// The single place that decides WHERE the mock backend's data lives.
//
// Handlers import `store` from here and only use the DataStore API
// (read / write / reset / onExternalChange). To move to a different storage
// engine, implement DataStore (see ./types) and change the binding below —
// nothing else needs to change.

import { createSeedDb } from '../data';
import { createIndexedDbStore } from './indexeddb';
import type { DataStore } from './types';

/**
 * Bump when the seed data or record shapes change, so data saved by an older
 * version is replaced with the new seed instead of being mixed with it.
 */
export const SEED_VERSION = 2;

export const store: DataStore = createIndexedDbStore({
  seed: createSeedDb,
  seedVersion: SEED_VERSION,
  dbName: 'testdesk',
});

export type { CollectionName, Collections, DataStore, Dataset, ReadTx, WriteTx } from './types';
export { StoreError } from './types';
