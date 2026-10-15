import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env local.',
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = isSupabaseConfigured ? createSupabaseClient() : null;
