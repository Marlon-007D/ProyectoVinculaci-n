export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  get hasSupabaseConfig() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  },
}
