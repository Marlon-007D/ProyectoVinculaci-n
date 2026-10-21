import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const jwt = claims => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.c3ludGhldGljLXNpZ25hdHVyZQ`;
const anonKey = jwt({ role: 'anon' });
const env = { VITE_SUPABASE_URL: 'https://security-test.invalid', VITE_SUPABASE_ANON_KEY: anonKey };
let sequence = 0;

// Compile the real modules without Vite, supplying synthetic env values only.
function moduleUrl(path, values = env) {
  let source = readFileSync(resolve(path), 'utf8').replaceAll('import.meta.env', JSON.stringify(values));
  source = source.replace(/from '([^']+)'/g, (_, specifier) => {
    const target = specifier === '@supabase/supabase-js'
      ? import.meta.resolve(specifier)
      : moduleUrl(resolve(path, '..', `${specifier}.ts`), values);
    return `from '${target}'`;
  });
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } });
  return `data:text/javascript;base64,${Buffer.from(outputText + `\n// instance ${sequence++}`).toString('base64')}`;
}

test('public requests remain anonymous while the admin client has a session', async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), authorization: new Headers(options.headers).get('authorization') });
    const body = String(url).includes('/auth/v1/user')
      ? { id: 'a0000000-0000-0000-0000-000000000001', aud: 'authenticated' }
      : [{ module_name: 'portal' }];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  let admin;
  try {
    ({ supabase: admin } = await import(moduleUrl('src/core/supabaseClient.ts')));
    const { publicSupabase, getPublicEnabledModules } = await import(moduleUrl('src/core/supabase/publicClient.ts'));
    const accessToken = jwt({ role: 'authenticated', sub: 'a0000000-0000-0000-0000-000000000001', exp: Math.floor(Date.now() / 1000) + 3600 });
    const { error } = await admin.auth.setSession({ access_token: accessToken, refresh_token: 'synthetic-refresh-token' });
    assert.equal(error, null);
    await admin.from('profiles').select('profile_id');
    assert.equal(requests.at(-1).authorization, `Bearer ${accessToken}`);
    assert.deepEqual(await getPublicEnabledModules('tenant-a'), ['portal']);
    assert.equal(requests.at(-1).authorization, `Bearer ${anonKey}`);
    assert.equal((await publicSupabase.auth.getSession()).data.session, null);
    assert.equal(publicSupabase.auth.persistSession, false);
    assert.equal(publicSupabase.auth.autoRefreshToken, false);
    assert.equal(publicSupabase.auth.detectSessionInUrl, false);
    assert.notEqual(publicSupabase.auth.storageKey, admin.auth.storageKey);
  } finally {
    admin?.auth.stopAutoRefresh();
    globalThis.fetch = previousFetch;
  }
});

test('browser config rejects privileged server keys and malformed keys', async () => {
  for (const key of ['sb_secret_example', jwt({ role: 'service_role' }), 'invalid-key']) {
    await assert.rejects(import(moduleUrl('src/core/supabase/config.ts', { ...env, VITE_SUPABASE_ANON_KEY: key })), /clave publica/);
  }
  await assert.doesNotReject(import(moduleUrl('src/core/supabase/config.ts', { ...env, VITE_SUPABASE_ANON_KEY: 'sb_publishable_example' })));
});

test('storage paths cannot escape a tenant directory', async () => {
  const { tenantObjectPath } = await import(moduleUrl('src/core/supabase/storage.ts'));
  const tenant = 'A0000000-0000-0000-0000-000000000001';
  assert.equal(tenantObjectPath(tenant, 'gallery/logo.png'), `${tenant.toLowerCase()}/gallery/logo.png`);
  for (const path of ['', '../secret', '/absolute', 'nested//file', 'a/./file', 'a\\file']) {
    assert.throws(() => tenantObjectPath(tenant, path));
  }
  assert.throws(() => tenantObjectPath('another-tenant', 'file'));
});
