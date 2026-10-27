import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OfflineStoreName =
  | 'events'
  | 'guests'
  | 'tasks'
  | 'budget'
  | 'cart'
  | 'listingSnapshots'
  | 'questionnaireDrafts'
  | 'messages'
  | 'mutationOutbox'
  | 'syncConflicts'
  | 'metadata';

export interface MutationRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  sequence: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  idempotencyKey: string;
  attempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'processing' | 'failed';
  lastError?: string;
}

export interface ConflictRecord {
  id: string;
  createdAt: number;
  resource: string;
  resourceId?: string;
  reason: string;
  localValue?: unknown;
  serverValue?: unknown;
  resolved: boolean;
}

interface ESSOfflineDB extends DBSchema {
  events: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  guests: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  tasks: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  budget: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  cart: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  listingSnapshots: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  questionnaireDrafts: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  messages: { key: string; value: { id: string; data: unknown; updatedAt: number }; indexes: { 'by-updated': number } };
  mutationOutbox: { key: string; value: MutationRecord; indexes: { 'by-sequence': number; 'by-next-attempt': number } };
  syncConflicts: { key: string; value: ConflictRecord; indexes: { 'by-created': number } };
  metadata: { key: string; value: number };
}

const DB_NAME = 'ess-offline';
const DB_VERSION = 2;
let dbPromise: Promise<IDBPDatabase<ESSOfflineDB>> | undefined;

export function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB<ESSOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const resources: OfflineStoreName[] = [
          'events', 'guests', 'tasks', 'budget', 'cart', 'listingSnapshots',
          'questionnaireDrafts', 'messages',
        ];
        for (const name of resources) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name);
            (store as unknown as IDBObjectStore).createIndex('by-updated', 'updatedAt');
          }
        }
        if (!db.objectStoreNames.contains('mutationOutbox')) {
          const store = db.createObjectStore('mutationOutbox');
          store.createIndex('by-sequence', 'sequence');
          store.createIndex('by-next-attempt', 'nextAttemptAt');
        }
        if (!db.objectStoreNames.contains('syncConflicts')) {
          const store = db.createObjectStore('syncConflicts');
          store.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('metadata')) {
          const store = db.createObjectStore('metadata');
          store.put(0, 'mutationSequence');
        }
      },
    });
  }
  return dbPromise;
}

export async function nextMutationSequence() {
  const db = await getOfflineDB();
  const tx = db.transaction('metadata', 'readwrite');
  const current = (await tx.store.get('mutationSequence')) ?? 0;
  const next = Math.max(Date.now() * 1000, current + 1);
  await tx.store.put(next, 'mutationSequence');
  await tx.done;
  return next;
}

export async function putOffline(store: Exclude<OfflineStoreName, 'mutationOutbox' | 'syncConflicts' | 'metadata'>, id: string, data: unknown) {
  const db = await getOfflineDB();
  await db.put(store, { id, data, updatedAt: Date.now() }, id);
}

export async function getOffline<T>(store: Exclude<OfflineStoreName, 'mutationOutbox' | 'syncConflicts' | 'metadata'>, id: string): Promise<T | undefined> {
  const db = await getOfflineDB();
  const value = await db.get(store, id);
  return value?.data as T | undefined;
}

export async function listOffline<T>(store: Exclude<OfflineStoreName, 'mutationOutbox' | 'syncConflicts' | 'metadata'>): Promise<T[]> {
  const db = await getOfflineDB();
  const values = await db.getAll(store);
  return values.map((item) => item.data as T);
}

export async function countPendingMutations() {
  const db = await getOfflineDB();
  const values = await db.getAll('mutationOutbox');
  return values.filter((item) => item.status !== 'failed' || item.attempts < 8).length;
}

export async function addConflict(conflict: ConflictRecord) {
  const db = await getOfflineDB();
  await db.put('syncConflicts', conflict, conflict.id);
}

export async function listConflicts(unresolvedOnly = true) {
  const db = await getOfflineDB();
  const values = await db.getAllFromIndex('syncConflicts', 'by-created');
  return unresolvedOnly ? values.filter((item) => !item.resolved) : values;
}

export async function resolveConflict(id: string) {
  const db = await getOfflineDB();
  const conflict = await db.get('syncConflicts', id);
  if (!conflict) return;
  await db.put('syncConflicts', { ...conflict, resolved: true }, id);
}
