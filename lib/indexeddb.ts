'use client';

/**
 * IndexedDB wrapper for offline caching and background queues.
 *
 * Stores:
 * - tasks:          cached tasks by id
 * - notifications:  cached notifications by id
 * - forms:          queued form submissions (id auto, payload, status, createdAt)
 * - images:         queued image uploads (id auto, blob, metadata)
 * - signatures:     queued signature uploads (id auto, blob, metadata)
 *
 * All APIs are browser-only and will gracefully no-op if IndexedDB is unavailable.
 */

export type Json = Record<string, any>;

export interface QueuedForm {
  id?: number;
  payload: Json;
  status?: 'queued' | 'sending' | 'failed' | 'done';
  createdAt?: number;
}

export interface QueuedBlobRecord {
  id?: number;
  blob: Blob;
  metadata?: Json;
  createdAt?: number;
}

export interface CachedTask {
  id: string;
  [key: string]: any;
}

export interface CachedNotification {
  id: string;
  [key: string]: any;
}

const DB_NAME = 'toyota-sos';
const DB_VERSION = 1;

const STORES = {
  tasks: 'tasks',
  notifications: 'notifications',
  forms: 'forms',
  images: 'images',
  signatures: 'signatures',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function promisify<T = any>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openDB(): Promise<IDBDatabase | null> {
  if (!hasIndexedDB()) return null;
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // id stores
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        db.createObjectStore(STORES.tasks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.notifications)) {
        db.createObjectStore(STORES.notifications, { keyPath: 'id' });
      }
      // queue stores (auto-increment numeric ids)
      if (!db.objectStoreNames.contains(STORES.forms)) {
        const s = db.createObjectStore(STORES.forms, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt', { unique: false });
        s.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.images)) {
        const s = db.createObjectStore(STORES.images, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.signatures)) {
        const s = db.createObjectStore(STORES.signatures, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => Promise<T> | T): Promise<T | null> {
  const db = await openDB();
  if (!db) return null;
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    const done = async () => {
      try {
        const res = await run(s);
        resolve(res);
      } catch (e) {
        reject(e);
      }
    };
    // Run inside next microtask to ensure transaction is open
    Promise.resolve().then(done);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  }).catch(() => null);
}

// Tasks cache
export async function cachePutTask(task: CachedTask): Promise<boolean> {
  const res = await withStore(STORES.tasks, 'readwrite', (s) => promisify(s.put(task)));
  return res !== null;
}
export async function cacheGetTask(id: string): Promise<CachedTask | null> {
  const res = await withStore<CachedTask>(STORES.tasks, 'readonly', (s) => promisify(s.get(id)));
  return (res as any) ?? null;
}
export async function cacheGetAllTasks(): Promise<CachedTask[]> {
  const res = await withStore<CachedTask[]>(STORES.tasks, 'readonly', (s) => promisify(s.getAll()));
  return (res as any) ?? [];
}
export async function cacheDeleteTask(id: string): Promise<boolean> {
  const res = await withStore(STORES.tasks, 'readwrite', (s) => promisify(s.delete(id)));
  return res !== null;
}

// Notifications cache
export async function cachePutNotification(n: CachedNotification): Promise<boolean> {
  const res = await withStore(STORES.notifications, 'readwrite', (s) => promisify(s.put(n)));
  return res !== null;
}
export async function cacheGetAllNotifications(): Promise<CachedNotification[]> {
  const res = await withStore<CachedNotification[]>(STORES.notifications, 'readonly', (s) => promisify(s.getAll()));
  return (res as any) ?? [];
}
export async function cacheDeleteNotification(id: string): Promise<boolean> {
  const res = await withStore(STORES.notifications, 'readwrite', (s) => promisify(s.delete(id)));
  return res !== null;
}

// Forms queue
export async function enqueueForm(payload: Json): Promise<number | null> {
  const record: QueuedForm = { payload, status: 'queued', createdAt: Date.now() };
  const res = await withStore<IDBValidKey>(STORES.forms, 'readwrite', (s) => promisify(s.add(record as any)));
  return typeof res === 'number' ? res : null;
}
export async function getQueuedForms(): Promise<QueuedForm[]> {
  const res = await withStore<QueuedForm[]>(STORES.forms, 'readonly', (s) => promisify(s.getAll()));
  return (res as any) ?? [];
}
export async function updateForm(id: number, patch: Partial<QueuedForm>): Promise<boolean> {
  const ok = await withStore<boolean>(STORES.forms, 'readwrite', async (s) => {
    const cur = await promisify<any>(s.get(id));
    if (!cur) return false;
    const next = { ...cur, ...patch };
    await promisify(s.put(next));
    return true;
  });
  return ok === true;
}
export async function deleteForm(id: number): Promise<boolean> {
  const res = await withStore(STORES.forms, 'readwrite', (s) => promisify(s.delete(id)));
  return res !== null;
}

// Images queue
export async function enqueueImage(blob: Blob, metadata?: Json): Promise<number | null> {
  const record: QueuedBlobRecord = { blob, metadata: metadata || {}, createdAt: Date.now() };
  const res = await withStore<IDBValidKey>(STORES.images, 'readwrite', (s) => promisify(s.add(record as any)));
  return typeof res === 'number' ? res : null;
}
export async function getQueuedImages(): Promise<QueuedBlobRecord[]> {
  const res = await withStore<QueuedBlobRecord[]>(STORES.images, 'readonly', (s) => promisify(s.getAll()));
  return (res as any) ?? [];
}
export async function deleteImage(id: number): Promise<boolean> {
  const res = await withStore(STORES.images, 'readwrite', (s) => promisify(s.delete(id)));
  return res !== null;
}

// Signatures queue
export async function enqueueSignature(blob: Blob, metadata?: Json): Promise<number | null> {
  const record: QueuedBlobRecord = { blob, metadata: metadata || {}, createdAt: Date.now() };
  const res = await withStore<IDBValidKey>(STORES.signatures, 'readwrite', (s) => promisify(s.add(record as any)));
  return typeof res === 'number' ? res : null;
}
export async function getQueuedSignatures(): Promise<QueuedBlobRecord[]> {
  const res = await withStore<QueuedBlobRecord[]>(STORES.signatures, 'readonly', (s) => promisify(s.getAll()));
  return (res as any) ?? [];
}
export async function deleteSignature(id: number): Promise<boolean> {
  const res = await withStore(STORES.signatures, 'readwrite', (s) => promisify(s.delete(id)));
  return res !== null;
}


