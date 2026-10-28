import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantAdminService, validateTenantSnapshot } from './tenantAdminService.ts';

import { snapshotFixture, assignmentFixture } from './mocks/tenantManagement.mjs';

test('invitation forwards the institution callback and reports email delivery separately', async () => {
  const calls = [];
  const service = createTenantAdminService({ rpc: async () => { throw new Error('Invitations must not call assignment or approval RPCs'); }, functions: { invoke: async (name, options) => {
    if (options.body.action === 'capabilities') return { data: { invitationContract: 'pending-v1' }, error: null };
    calls.push({ name, options }); return { data: { assigned: true, pending: true, notificationSent: false }, error: null };
  } } });
  const redirect_to = 'http://localhost:5173/login?institution=a&slug=school-a';
  assert.deepEqual(await service.invite({ ...assignmentFixture, redirect_to }), { notificationSent: false });
  assert.equal(calls[0].name, 'admin-tenant-invite');
  assert.deepEqual(calls[0].options.body, { ...assignmentFixture, redirect_to, action: 'invite' });
  assert.equal(calls[0].options.body.redirect_to, redirect_to);
});

test('an outdated Edge Function is rejected before creating an invitation or active membership', async () => {
  const calls=[];
  const service=createTenantAdminService({rpc:async()=>({}),functions:{invoke:async(name,options)=>{calls.push(options.body);return {data:{assigned:true},error:null};}}});
  await assert.rejects(service.invite({...assignmentFixture,redirect_to:'http://localhost:5173/panel/admin?institution=a&slug=school-a'}),/Actualiza/);
  assert.deepEqual(calls,[{action:'capabilities'}]);
});

test('invitation API failures surface the server message without any database fallback', async () => {
  const service=createTenantAdminService({rpc:async()=>{throw new Error('Unexpected database fallback');},functions:{invoke:async(name,options)=>{
    if(options.body.action==='capabilities')return {data:{invitationContract:'pending-v1'},error:null};
    return {data:null,error:{context:new Response(JSON.stringify({error:'La cuenta ya existe; no se activó ninguna membresía.'}),{status:409,headers:{'content-type':'application/json'}})}};
  }}});
  await assert.rejects(service.invite({...assignmentFixture,redirect_to:'http://localhost:5173/panel/admin?institution=a&slug=school-a'}),/no se activó/);
});

test('snapshot rejects other institutions and malformed payloads instead of displaying them', () => {
  assert.equal(validateTenantSnapshot(snapshotFixture(),'a').institution_id,'a');
  const foreign = snapshotFixture(); foreign.members[0].institution_id='b';
  assert.throws(() => validateTenantSnapshot(foreign,'a'),/ajenos/);
  assert.throws(() => validateTenantSnapshot(snapshotFixture(),'b'),/contrato/);
  const malformed = snapshotFixture(); malformed.members[0].modules=null;
  assert.throws(() => validateTenantSnapshot(malformed,'a'),/incompletos/);
});

test('every RPC uses an explicit institution and never falls back to old global operations', async () => {
  const calls=[];
  const service=createTenantAdminService({ rpc:async(name,args)=>{calls.push({name,args});return {data:snapshotFixture(),error:null};}, functions:{} });
  await service.load('a'); await service.remove('a','person');
  assert.equal(calls.at(-1).name, 'admin_tenant_remove_role');
  assert.equal(calls.at(-1).args.target_profile_id, 'person');
  assert(calls.every(call=>call.name.startsWith('admin_tenant_') && call.args.target_institution_id==='a'));
  const missing=createTenantAdminService({rpc:async(name)=>{calls.push({name});return {data:null,error:{message:'Contract not installed',code:'PGRST202'}};},functions:{}});
  await assert.rejects(missing.load('a'),/Contract not installed/);
  assert.equal(calls.at(-1).name,'admin_tenant_snapshot');
});

test('RPC failures are reported without activating members or calling a fallback', async () => {
  for (const code of ['P0002', '42501']) {
    const calls=[];
    const service=createTenantAdminService({rpc:async name=>{calls.push(name);return {data:null,error:{code,message:'Rejected'}};},functions:{}});
    await assert.rejects(service.remove('a','person'),/Rejected/);
    assert.deepEqual(calls,['admin_tenant_remove_role']);
  }
});
test('approval uses the scoped registration RPC with role and modules and never sends invitations', async () => {
  const calls = [];
  const service = createTenantAdminService({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; }, functions: { invoke: () => { throw new Error('Unexpected invitation'); } } });
  await service.approve({ ...assignmentFixture, profileId: 'person', requestId: 'request' });
  assert.equal(calls[0].name, 'admin_tenant_approve_registration');
  assert.equal(calls[0].args.target_institution_id, assignmentFixture.institutionId);
  assert.equal(calls[0].args.target_profile_id, 'person');
  assert.deepEqual(calls[0].args.target_modules, assignmentFixture.modules);
});
test('editing passes selected modules unchanged and notification failure does not roll back the edit', async () => {
  const calls = [];
  const service = createTenantAdminService({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; },
    functions: { invoke: async (name, options) => { calls.push({ name, options }); return { data: null, error: new Error('Rate limit') }; } } });
  await service.edit(assignmentFixture);
  assert.equal(calls[0].name, 'admin_tenant_update_access');
  assert.deepEqual(calls[0].args.target_modules, assignmentFixture.modules);
  assert.deepEqual(await service.notify({ institutionId: 'a', profileId: 'person', redirect_to: 'https://school.test/panel/admin?institution=a&slug=a' }), { notificationSent: false });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.body.action, 'notify_access');
});
test('invalid request emails cannot reach edit, approval or invitation APIs', async () => {
  const client = { rpc: async () => { throw new Error('Unexpected request'); }, functions: { invoke: async () => { throw new Error('Unexpected request'); } } };
  const service = createTenantAdminService(client);
  const input = { ...assignmentFixture, email: 'gjbrito@espe.edu.ec333333333' };
  await assert.rejects(service.edit(input), /correo/);
  await assert.rejects(service.approve({ ...input, profileId: 'person', requestId: 'request' }), /correo/);
  await assert.rejects(service.invite({ ...input, redirect_to: 'http://localhost:5173/panel/admin?institution=a&slug=a' }), /correo/);
});
