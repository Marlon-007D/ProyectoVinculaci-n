const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  throw new Error('Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.');
}

// Browser bundles must never contain a service_role or sb_secret_ key.
// Decoding is a configuration check, not authentication; Supabase verifies JWTs.
if (!supabaseAnonKey.startsWith('sb_publishable_')) {
  try {
    const payload = supabaseAnonKey.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    if (claims.role !== 'anon') throw new Error('Unexpected role');
  } catch {
    throw new Error('VITE_SUPABASE_ANON_KEY debe ser una clave publica anon o sb_publishable_, nunca una clave de servidor.');
  }
}

export { supabaseUrl, supabaseAnonKey };
