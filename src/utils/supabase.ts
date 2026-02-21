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

const READ_TIMEOUT = 5000;
const WRITE_TIMEOUT = 8000;

/** Read a value from Supabase app_data table */
export async function supabaseGet<T>(key: string): Promise<T | undefined> {
  const supabase = getSupabase();
  const { data, error } = await withTimeout(
    supabase.from('app_data').select('value').eq('key', key).single(),
    READ_TIMEOUT,
    `GET ${key}`
  );

  if (error || !data) return undefined;
  return data.value as T;
}

/** Write a value to Supabase app_data table (upsert) */
export async function supabaseSet<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();

  const { error: upsertError } = await withTimeout(
    supabase.from('app_data').upsert(
      { key, value: value as any, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    ),
    WRITE_TIMEOUT,
    `SET ${key}`
  );

  if (upsertError) {
    console.error(`[Supabase] upsert failed for "${key}":`, upsertError.message);
    const { error: updateError } = await withTimeout(
      supabase.from('app_data')
        .update({ value: value as any, updated_at: new Date().toISOString() })
        .eq('key', key),
      WRITE_TIMEOUT,
      `UPDATE ${key}`
    );

    if (updateError) {
      console.error(`[Supabase] update also failed for "${key}":`, updateError.message);
      throw updateError;
    }
    console.log(`[Supabase] saved "${key}" via UPDATE fallback`);
  }
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
