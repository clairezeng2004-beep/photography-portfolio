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
const WRITE_TIMEOUT = 15000;

/**
 * Result from supabaseGet — distinguishes "key not found" from "network error".
 * - found=true, value=T  → key exists in cloud
 * - found=false           → key does not exist in cloud (but cloud IS reachable)
 * On network/timeout error the function throws.
 */
export interface CloudGetResult<T> {
  found: boolean;
  value?: T;
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
    supabase.from('app_data').select('value').eq('key', key).single(),
    READ_TIMEOUT,
    `GET ${key}`
  );

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned" → row doesn't exist
    if (error.code === 'PGRST116') {
      return { found: false };
    }
    // Any other error is a real failure (network, permission, etc.)
    throw error;
  }

  if (!data) return { found: false };
  return { found: true, value: data.value as T };
}

/** Write a value to Supabase app_data table (upsert) with verification */
export async function supabaseSet<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const row = { key, value: value as any, updated_at: now };

  // Try upsert first
  const { error: upsertError } = await withTimeout(
    supabase.from('app_data').upsert(row, { onConflict: 'key' }),
    WRITE_TIMEOUT,
    `SET ${key}`
  );

  if (upsertError) {
    console.error(`[Supabase] upsert failed for "${key}":`, upsertError.message, upsertError.code);

    // If upsert failed, try explicit insert-or-update approach
    // First check if row exists
    const existing = await supabaseGetDetailed(key).catch(() => null);
    
    if (existing && existing.found) {
      // Row exists → update
      const { error: updateError } = await withTimeout(
        supabase.from('app_data')
          .update({ value: value as any, updated_at: now })
          .eq('key', key),
        WRITE_TIMEOUT,
        `UPDATE ${key}`
      );
      if (updateError) {
        console.error(`[Supabase] update also failed for "${key}":`, updateError.message);
        throw updateError;
      }
      console.log(`[Supabase] saved "${key}" via UPDATE fallback`);
    } else {
      // Row doesn't exist → insert
      const { error: insertError } = await withTimeout(
        supabase.from('app_data').insert(row),
        WRITE_TIMEOUT,
        `INSERT ${key}`
      );
      if (insertError) {
        console.error(`[Supabase] insert also failed for "${key}":`, insertError.message);
        throw insertError;
      }
      console.log(`[Supabase] saved "${key}" via INSERT fallback`);
    }
    return;
  }

  // Verify the write actually persisted (non-blocking — log only, don't throw)
  try {
    const verify = await supabaseGetDetailed(key);
    if (!verify.found) {
      // Upsert said success but row not found — try insert as a recovery attempt
      console.warn(`[Supabase] verification: "${key}" not found after upsert, attempting INSERT...`);
      const { error: insertError } = await withTimeout(
        supabase.from('app_data').insert(row),
        WRITE_TIMEOUT,
        `INSERT-VERIFY ${key}`
      );
      if (insertError) {
        // Insert failed (likely duplicate key = row actually exists, verification was a fluke)
        console.warn(`[Supabase] INSERT-VERIFY for "${key}" failed (may be OK if row exists):`, insertError.message);
      } else {
        console.log(`[Supabase] saved "${key}" via INSERT after verification miss`);
      }
    }
  } catch (verifyErr) {
    // Don't fail the whole operation if verification read itself fails
    console.warn(`[Supabase] verification read failed for "${key}" (write likely succeeded):`, verifyErr);
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
