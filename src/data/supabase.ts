import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when env vars are missing: the app then stays fully local and the cloud UI says so. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const BUCKET = 'captures';
