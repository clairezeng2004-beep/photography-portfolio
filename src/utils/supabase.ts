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

/** Read a value from Supabase app_data table */
export async function supabaseGet<T>(key: string): Promise<T | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_data')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return undefined;
  return data.value as T;
}

/** Write a value to Supabase app_data table (upsert) */
export async function supabaseSet<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('app_data')
    .upsert(
      { key, value: value as any, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    console.error(`[Supabase] Failed to save "${key}":`, error.message);
    throw error;
  }
}

/** Delete a key from Supabase app_data table */
export async function supabaseDelete(key: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('app_data')
    .delete()
    .eq('key', key);

  if (error) {
    console.error(`[Supabase] Failed to delete "${key}":`, error.message);
    throw error;
  }
}
