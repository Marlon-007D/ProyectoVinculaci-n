import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
try {
  const url = new URL(env.VITE_SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || !['', '/'].includes(url.pathname)) throw new Error();
} catch {
  throw new Error('VITE_SUPABASE_URL debe ser la URL HTTPS del proyecto Supabase, sin rutas ni credenciales.');
}
const key = env.VITE_SUPABASE_ANON_KEY ?? '';
let publicKey = key.startsWith('sb_publishable_') && key.length > 'sb_publishable_'.length;
if (!publicKey) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    publicKey = key.split('.').length === 3 && claims.role === 'anon';
  } catch { /* Invalid or missing public key. */ }
}
if (!publicKey) throw new Error('VITE_SUPABASE_ANON_KEY debe ser una clave pública anon o sb_publishable_, nunca una clave privada.');
console.log('Configuración pública de Supabase válida para compilar (no verifica conectividad).');
