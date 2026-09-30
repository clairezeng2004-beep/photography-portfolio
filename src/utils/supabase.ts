const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

/** Check if Supabase is configured */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

const READ_TIMEOUT = 15000;
const WRITE_TIMEOUT = 30000;

function restBaseUrl(): string {
  const isBrowser = typeof window !== 'undefined';
  const host = isBrowser ? window.location.hostname : '';
  if (isBrowser && host !== 'localhost' && host !== '127.0.0.1') {
    return '/api/supabase/rest/v1';
  }
  return `${supabaseUrl}/rest/v1`;
}

async function supabaseFetch(path: string, init: RequestInit, timeout: number, label: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${restBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[Supabase] ${label} failed: HTTP ${res.status} ${body}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface CloudGetResult<T> {
  found: boolean;
  value?: T;
  updatedAt?: number;
}

/** Read a value from Supabase app_data table */
export async function supabaseGet<T>(key: string): Promise<T | undefined> {
  const result = await supabaseGetDetailed<T>(key);
  return result.found ? result.value : undefined;
}

/**
 * Detailed read — lets the caller distinguish "not found" from "unreachable".
 * Throws on network / timeout errors.
 */
export async function supabaseGetDetailed<T>(key: string): Promise<CloudGetResult<T>> {
  const res = await supabaseFetch(
    `/app_data?select=value,updated_at&key=eq.${encodeURIComponent(key)}&limit=1`,
    { method: 'GET' },
    READ_TIMEOUT,
    `GET ${key}`
  );
  const rows = await res.json();
  const data = rows[0];
  if (!data) return { found: false };
  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : undefined;
  return { found: true, value: data.value as T, updatedAt };
}

/**
 * Write a value to Supabase app_data table.
 * Single upsert — simple and reliable. Throws on failure.
 */
export async function supabaseSet<T>(key: string, value: T): Promise<void> {
  const now = new Date().toISOString();
  await supabaseFetch(
    '/app_data?on_conflict=key',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ key, value: value as any, updated_at: now }]),
    },
    WRITE_TIMEOUT,
    `SET ${key}`
  );
}

/**
 * Write with retry. Tries up to `maxRetries` times with exponential backoff.
 * Returns true if succeeded, false if all retries failed.
 */
export async function supabaseSetWithRetry<T>(key: string, value: T, maxRetries = 3): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await supabaseSet(key, value);
      return true;
    } catch (e: any) {
      console.warn(`[Supabase] write attempt ${attempt + 1}/${maxRetries + 1} failed for "${key}":`, e.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  return false;
}

/** Delete a key from Supabase app_data table */
export async function supabaseDelete(key: string): Promise<void> {
  await supabaseFetch(
    `/app_data?key=eq.${encodeURIComponent(key)}`,
    { method: 'DELETE' },
    WRITE_TIMEOUT,
    `DELETE ${key}`
  );
}

/* ============================================================
   Cloud Backup — automatic snapshots stored in app_data table
   Key format: backup__<timestamp>
   ============================================================ */

const BACKUP_KEY_PREFIX = 'backup__';
const MAX_BACKUPS = 10; // Keep at most 10 backups

export interface BackupEntry {
  key: string;
  timestamp: number;       // epoch ms
  label: string;           // human-readable time
}

/** Create a full-data backup snapshot */
export async function createBackup(snapshot: Record<string, any>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  const backupKey = `${BACKUP_KEY_PREFIX}${now}`;

  try {
    await supabaseSet(backupKey, snapshot);
    console.log(`[Backup] Created backup: ${backupKey}`);

    // Prune old backups beyond MAX_BACKUPS
    pruneOldBackups().catch(e => console.warn('[Backup] prune failed:', e));

    return true;
  } catch (e) {
    console.error('[Backup] Failed to create backup:', e);
    return false;
  }
}

/** List all backup entries (newest first) */
export async function listBackups(): Promise<BackupEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const res = await supabaseFetch(
    `/app_data?select=key,updated_at&key=like.${encodeURIComponent(`${BACKUP_KEY_PREFIX}%`)}&order=updated_at.desc`,
    { method: 'GET' },
    READ_TIMEOUT,
    'LIST backups'
  );
  const data = await res.json();

  return (data || []).map((row: any) => {
    const ts = parseInt(row.key.replace(BACKUP_KEY_PREFIX, ''), 10);
    return {
      key: row.key,
      timestamp: ts,
      label: new Date(ts).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    };
  });
}

/** Get a specific backup's data */
export async function getBackup(key: string): Promise<Record<string, any> | null> {
  if (!isSupabaseConfigured()) return null;
  const result = await supabaseGetDetailed<Record<string, any>>(key);
  return result.found ? (result.value || null) : null;
}

/** Delete a specific backup */
export async function deleteBackup(key: string): Promise<void> {
  await supabaseDelete(key);
}

/** Remove oldest backups if count exceeds MAX_BACKUPS */
async function pruneOldBackups(): Promise<void> {
  const all = await listBackups();
  if (all.length <= MAX_BACKUPS) return;

  const toDelete = all.slice(MAX_BACKUPS);
  for (const entry of toDelete) {
    try {
      await supabaseDelete(entry.key);
      console.log(`[Backup] Pruned old backup: ${entry.key}`);
    } catch (e) {
      console.warn(`[Backup] Failed to prune ${entry.key}:`, e);
    }
  }
}
