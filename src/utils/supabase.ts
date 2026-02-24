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

const READ_TIMEOUT = 8000;
const WRITE_TIMEOUT = 12000;

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
export async function supabaseSetWithRetry<T>(key: string, value: T, maxRetries = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await supabaseSet(key, value);
      return true;
    } catch (e: any) {
      console.warn(`[Supabase] write attempt ${attempt + 1}/${maxRetries + 1} failed for "${key}":`, e.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
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
