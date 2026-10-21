import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync('supabase/functions/invite-institution-user/index.ts', 'utf8')
  .replace(/^import .*createClient.*;\r?\n/, '');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const userId = 'a0000000-0000-0000-0000-000000000001';

function fixture({ profileError, assignmentError, unauthorized = false, role = 'student', callerRole = 'super_admin', callerInstitution = 'tenant', callerActive = true } = {}) {
  const events = [];
  const writes = [];
  const clients = [];
  const database = table => {
    let operation = 'select';
    let values;
    const filters = new Map();
    const query = {
      select() { return query; }, eq(key, value) { filters.set(key, value); return query; },
      in() { return Promise.resolve({ data: [{ role_id: 'global-role', name: callerRole }], error: null }); },
      upsert(row, options) { operation = 'upsert'; values = row; writes.push({ table, row, options }); return query; },
      maybeSingle() {
        return Promise.resolve({ data: table === 'roles' ? { role_id: 'target-role', name: role } : { institution_id: 'tenant', name: 'School', is_active: true }, error: null });
      },
      single() {
        events.push('profiles.upsert');
        return Promise.resolve({ data: profileError ? null : { profile_id: values.profile_id }, error: profileError ?? null });
      },
      then(resolve, reject) {
        if (operation === 'upsert') {
          events.push(`${table}.upsert`);
          return Promise.resolve({ error: assignmentError ?? null }).then(resolve, reject);
        }
        const excluded = unauthorized || (filters.get('is_active') === true && !callerActive);
        return Promise.resolve({ data: excluded ? [] : [{ institution_id: callerInstitution, role_id: 'global-role' }], error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  const admin = {
    from: database,
    auth: {
      async getUser(token) { assert.equal(token, 'caller-token'); return { data: { user: { id: 'inviter' } }, error: null }; },
      admin: {
        async inviteUserByEmail() { events.push('auth.invite'); return { data: { user: { id: userId } }, error: null }; },
        async deleteUser() { events.push('auth.delete'); },
      },
    },
  };
  let handler;
  const Deno = {
    env: { get: name => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'server-service-role-key' })[name] },
    serve: callback => { handler = callback; },
  };
  new Function('Deno', 'createClient', outputText)(Deno, (...args) => { clients.push(args); return admin; });
  const invoke = () => handler(new Request('https://example.invalid/functions/v1/invite-institution-user', {
    method: 'POST', headers: { Authorization: 'Bearer caller-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@test.invalid', firstName: 'Test', lastName: 'Student', phone: '0999999999', roleId: 'target-role', institutionId: 'tenant' }),
  }));
  return { invoke, events, writes, clients };
}

test('service role upserts the Auth profile before membership, including a profile already created by a trigger', async () => {
  const { invoke, events, writes, clients } = fixture();
  assert.equal((await invoke()).status, 200);
  assert.deepEqual(events, ['auth.invite', 'profiles.upsert', 'memberships.upsert']);
  assert.equal(clients.length, 1);
  assert.equal(clients[0][1], 'server-service-role-key');
  assert.equal(clients[0][2].global.headers.Authorization, 'Bearer server-service-role-key');
  assert.equal(clients[0][2].auth.persistSession, false);
  assert.equal(clients[0][2].db.schema, 'public');
  assert.equal(writes[0].row.profile_id, userId);
  assert.equal(writes[0].options.onConflict, 'profile_id');
  assert.equal(writes[1].row.profile_id, userId);
  assert.equal(writes[1].options.onConflict, 'institution_id,profile_id');
  assert.equal('mfa_enabled' in writes[0].row, false);
  assert.equal(writes[1].row.is_active, true);
});

test('profile error reports its code, keeps the invited account and skips membership', async () => {
  const { invoke, events } = fixture({ profileError: { code: '42501', message: 'permission denied' } });
  const response = await invoke();
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.stage, 'profile_upsert');
  assert.equal(body.code, '42501');
  assert.deepEqual(events, ['auth.invite', 'profiles.upsert']);
});

test('membership failure preserves both the invitation and the profile for retry', async () => {
  const { invoke, events } = fixture({ assignmentError: { code: '23503', message: 'foreign key violation' } });
  const response = await invoke();
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.stage, 'membership_upsert');
  assert.equal(body.code, '23503');
  assert.equal(events.includes('auth.delete'), false);
});

test('an unauthorized caller cannot invoke privileged writes or send invitations', async () => {
  const { invoke, events, writes } = fixture({ unauthorized: true });
  assert.equal((await invoke()).status, 403);
  assert.deepEqual(events, []);
  assert.deepEqual(writes, []);
});

test('active institution admin can invite a student to their own institution', async () => {
  const { invoke, writes } = fixture({ callerRole: 'institution_admin' });
  assert.equal((await invoke()).status, 200);
  assert.equal(writes[1].row.institution_id, 'tenant');
});

test('institution admin cannot invite to a different institution', async () => {
  const { invoke, events } = fixture({ callerRole: 'institution_admin', callerInstitution: 'other-tenant' });
  assert.equal((await invoke()).status, 403);
  assert.deepEqual(events, []);
});

test('revoked institution admin cannot send invitations', async () => {
  const { invoke, events } = fixture({ callerRole: 'institution_admin', callerActive: false });
  assert.equal((await invoke()).status, 403);
  assert.deepEqual(events, []);
});

test('institution admin cannot invite institutional or global administrators', async () => {
  for (const role of ['institution_admin', 'super_admin']) {
    const { invoke, events } = fixture({ callerRole: 'institution_admin', role });
    assert.ok([400, 403].includes((await invoke()).status));
    assert.deepEqual(events, []);
  }
});
