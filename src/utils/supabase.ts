import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Singleton Supabase client
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

/** Check if Supabase is configured */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/** Wrap a PromiseLike with a timeout (ms). Rejects with a timeout error if exceeded. */
function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, label: string): Promise<T> {
  const p = Promise.resolve(promiseLike);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[Supabase] timeout after ${ms}ms for "${label}"`)), ms);
    p.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

const READ_TIMEOUT = 15000;
const WRITE_TIMEOUT = 30000;

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
  const supabase = getSupabase();
  const { data, error } = await withTimeout(
    supabase.from('app_data').select('value, updated_at').eq('key', key).single(),
    READ_TIMEOUT,
    `GET ${key}`
  );

  if (error) {
    if (error.code === 'PGRST116') {
      return { found: false };
    }
    throw error;
  }

  if (!data) return { found: false };
  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : undefined;
  return { found: true, value: data.value as T, updatedAt };
}

/**
 * Write a value to Supabase app_data table.
 * Single upsert — simple and reliable. Throws on failure.
 */
export async function supabaseSet<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const row = { key, value: value as any, updated_at: now };

  const { error } = await withTimeout(
    supabase.from('app_data').upsert(row, { onConflict: 'key' }),
    WRITE_TIMEOUT,
    `SET ${key}`
  );

  if (error) {
    console.error(`[Supabase] upsert failed for "${key}":`, error.message, error.code);
    throw error;
  }
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
  const supabase = getSupabase();
  const { error } = await withTimeout(
    supabase.from('app_data').delete().eq('key', key),
    WRITE_TIMEOUT,
    `DELETE ${key}`
  );

  if (error) {
    console.error(`[Supabase] Failed to delete "${key}":`, error.message);
    throw error;
  }
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

  const supabase = getSupabase();
  const { data, error } = await withTimeout(
    supabase
      .from('app_data')
      .select('key, updated_at')
      .like('key', `${BACKUP_KEY_PREFIX}%`)
      .order('updated_at', { ascending: false }),
    READ_TIMEOUT,
    'LIST backups'
  );

  if (error) {
    console.error('[Backup] list failed:', error.message);
    return [];
  }

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
