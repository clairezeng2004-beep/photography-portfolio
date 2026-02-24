const DB_NAME = 'photo_portfolio_db';
const DB_VERSION = 2; // bumped for new store
const STORE_NAME = 'app_data';
const META_STORE = 'app_meta'; // stores timestamps & sync status

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Metadata for a stored key (timestamp + sync status) */
export interface KeyMeta {
  updatedAt: number; // epoch ms
  cloudSynced: boolean; // true if cloud write confirmed
}

/** Get metadata for a key */
export async function dbGetMeta(key: string): Promise<KeyMeta | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as KeyMeta | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Set metadata for a key */
export async function dbSetMeta(key: string, meta: KeyMeta): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.put(meta, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Save data with timestamp metadata */
export async function dbSetWithMeta<T>(key: string, value: T, cloudSynced: boolean = false): Promise<number> {
  const ts = Date.now();
  await dbSet(key, value);
  await dbSetMeta(key, { updatedAt: ts, cloudSynced });
  return ts;
}

/** Get all keys that need cloud sync (saved locally but cloud write failed/pending) */
export async function dbGetPendingSyncKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.openCursor();
    const pending: string[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const meta = cursor.value as KeyMeta;
        if (!meta.cloudSynced) {
          pending.push(cursor.key as string);
        }
        cursor.continue();
      } else {
        resolve(pending);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
