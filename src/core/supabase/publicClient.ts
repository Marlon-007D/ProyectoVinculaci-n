import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './config';

// Axel's public portal: no administrative session, URL callback or localStorage.
// Use this client only for public queries, never for signIn/setSession.
export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'institutional-public-anon',
  },
});

export async function getPublicEnabledModules(slug: string): Promise<string[]> {
  const { data, error } = await publicSupabase.rpc('get_public_enabled_modules', { target_slug: slug });
  if (error) throw error;
  return (data ?? []).map((row: { module_name: string }) => row.module_name);
}
