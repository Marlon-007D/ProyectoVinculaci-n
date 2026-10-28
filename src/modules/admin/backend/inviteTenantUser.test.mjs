import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantInvitation } from './inviteTenantUser.ts';
import { assignmentFixture } from '../userManagement/mocks/tenantManagement.mjs';

const env={supabaseUrl:'https://backend.example.test',publicKey:'public-test-key',serviceRoleKey:'server-test-key',allowedOrigins:['http://localhost:5173']};
const request=(redirect_to='http://localhost:5173/login?institution=a&slug=school-a')=>new Request('https://function.example.test',{method:'POST',headers:{authorization:'Bearer caller-token',origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify({...assignmentFixture,redirect_to,action:'invite'})});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('malformed institutional emails fail explicitly before any Auth creation or membership write', async () => {
  let calls = 0;
  const response = await handleTenantInvitation(new Request('https://function.example.test', {
    method: 'POST', headers: { authorization: 'Bearer caller-token', origin: env.allowedOrigins[0] },
    body: JSON.stringify({ ...assignmentFixture, email: 'gjbrito@espe.edu.ec333333333', redirect_to: 'http://localhost:5173/panel/admin?institution=a&slug=school-a' }),
  }), env, async () => { calls++; throw new Error('Unexpected network operation'); });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /correo/);
  assert.equal(calls, 0);
});

test('existing confirmed and unconfirmed Auth users receive pending institutional access without account deletion',async()=>{
  for(const confirmed of [true,false]){
    const calls=[];
    const response=await handleTenantInvitation(request(),env,async(url,init)=>{
      calls.push({url,init});
      if(url.endsWith('/user'))return json({id:'actor'});
      if(url.endsWith('/admin_tenant_capabilities'))return json(true);
      if(url.includes('/institutions?'))return json([{institution_id:'a',slug:'school-a',is_active:true}]);
      if(url.includes('/roles?'))return json([{role_id:'teacher',name:'teacher'}]);
      if(url.endsWith('/admin/users'))return json({code:422,error_code:'email_exists'},422);
      if(url.endsWith('/admin_tenant_invitation_recipient'))return json({profile_id:'existing-profile',confirmed});
      return json(null);
    });
    assert.deepEqual(await response.json(),{assigned:true,pending:true,notificationSent:true});
    assert(!calls.some(call => call.url.endsWith('/admin/users')), 'Existing Auth users must not be recreated');
    assert(calls.some(call=>call.url.endsWith('/admin_tenant_prepare_invitation')));
    const email=calls.find(call=>call.url.includes(confirmed?'/otp?':'/invite?'));
    assert(email);
    if(confirmed)assert.equal(JSON.parse(email.init.body).create_user,false);
    assert(!calls.some(call=>['DELETE','PUT','PATCH'].includes(call.init.method)));
  }
});

test('a failed preparation never deletes or resets an existing Auth account',async()=>{
  const calls=[];
  const response=await handleTenantInvitation(request(),env,async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/user'))return json({id:'actor'});
    if(url.endsWith('/admin_tenant_capabilities'))return json(true);
    if(url.includes('/institutions?'))return json([{institution_id:'a',slug:'school-a',is_active:true}]);
    if(url.includes('/roles?'))return json([{role_id:'teacher',name:'teacher'}]);
    if(url.endsWith('/admin/users'))return json({code:'email_exists'},422);
    if(url.endsWith('/admin_tenant_invitation_recipient'))return json({profile_id:'existing-profile',confirmed:true});
    return json({error:'Denied'},403);
  });
  assert.equal(response.status,500);
  assert(!calls.some(call=>call.init.method==='DELETE'||call.url.includes('/otp?')));
});

test('existing invitation endpoint routes delete_member without creating accounts or sending emails', async () => {
  const calls=[];
  const deleteRequest=new Request('https://function.example.test',{method:'POST',headers:{authorization:'Bearer caller-token',origin:'http://localhost:5173'},body:JSON.stringify({action:'delete_member',institution_id:'a',profile_id:'person'})});
  const response=await handleTenantInvitation(deleteRequest,env,async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/user'))return json({id:'actor'});
    if(url.endsWith('/admin_tenant_snapshot'))return json({institution_id:'a',actor_role:'institution_admin',members:[{institution_id:'a',profile_id:'person',role_name:'institution_admin'}]});
    return json([{institution_id:'a',profile_id:'person'}]);
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).deleted,true);
  assert(calls.some(call=>call.init.method==='DELETE'));
  assert(!calls.some(call=>call.url.includes('/admin/users')||call.url.includes('/invite?')));
});

test('unknown actions fail without calling Auth, DELETE or invitations', async () => {
  const response=await handleTenantInvitation(new Request('https://function.example.test',{method:'POST',headers:{authorization:'Bearer caller-token'},body:JSON.stringify({action:'unsupported'})}),env,async()=>{throw new Error('Unexpected backend request');});
  assert.equal(response.status,400);
});

test('invitation email carries the verified institution callback and uses the invite endpoint', async () => {
  const calls = [];
  const response = await handleTenantInvitation(request('http://localhost:5173/panel/admin?institution=a&slug=school-a'), env, async (url, init) => {
    calls.push({url,init});
    if (url.endsWith('/user')) return json({id:'actor'});
    if (url.endsWith('/admin_tenant_capabilities')) return json(true);
    if (url.includes('/institutions?')) return json([{institution_id:'a',slug:'school-a',is_active:true}]);
    if (url.includes('/roles?')) return json([{role_id:'teacher',name:'teacher'}]);
    if (url.endsWith('/admin/users')) return json({id:'new-profile'});
    return json(null);
  });
  assert.deepEqual(await response.json(), {assigned:true,pending:true,notificationSent:true});
  const invite = calls.find(call => call.url.includes('/invite?'));
  const callback=new URL(new URL(invite.url).searchParams.get('redirect_to'));
  assert.equal(callback.pathname,'/panel/admin');
  assert.equal(callback.searchParams.get('institution'),'a');
  assert.deepEqual([...callback.searchParams.keys()].sort(),['institution','slug']);
  assert.equal(invite.init.headers.Authorization, 'Bearer server-test-key');
  const metadata=JSON.parse(invite.init.body).data;
  assert.deepEqual(metadata,{first_name:assignmentFixture.firstName,last_name:assignmentFixture.lastName,phone:assignmentFixture.phone,
    email:assignmentFixture.email,institution_id:'a',slug:'school-a',role_id:'teacher',role:'teacher',admin_tenant_onboarding:true});
  const creation=calls.find(call=>call.url.endsWith('/admin/users'));
  assert.deepEqual(JSON.parse(creation.init.body).user_metadata,metadata);
  assert.deepEqual(JSON.parse(creation.init.body).app_metadata.admin_tenant_invitation,metadata);
  assert.equal(callback.searchParams.has('email'),false);
});

test('invalid origin, cross-institution callback and conflicting slug cannot create accounts', async () => {
  for (const redirect of ['https://evil.example/login?institution=a&slug=school-a', 'http://localhost:5173/login?institution=b&slug=school-b', 'http://localhost:5173/login?institution=a&slug=school-b']) {
    const calls = [];
    const response = await handleTenantInvitation(request(redirect), env, async (url, init) => {
      calls.push({url,init});
      if (url.endsWith('/user')) return json({id:'actor'});
      if (url.endsWith('/admin_tenant_capabilities')) return json(true);
      return json([{institution_id:'a',slug:'school-a',is_active:true}]);
    });
    assert.equal(response.status, 400);
    assert(!calls.some(call => call.url.includes('/admin/users')));
  }
});

test('denied scope never creates an Auth account or uses server privileges', async()=>{
  const calls=[];
  const response=await handleTenantInvitation(request(),env,async(url,init)=>{calls.push({url,init});return url.endsWith('/user')?json({id:'actor'}):json(false);});
  assert.equal(response.status,403);
  assert(calls.every(call=>call.init.headers.Authorization==='Bearer caller-token'));
  assert(!calls.some(call=>call.url.includes('/admin/users')));
});

test('accented stored slug accepts the canonical callback without adding personal URL parameters',async()=>{
  const calls=[];
  const response=await handleTenantInvitation(request('http://localhost:5173/panel/admin?institution=a&slug=ue-luz-de-america'),env,async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/user'))return json({id:'actor'});
    if(url.endsWith('/admin_tenant_capabilities'))return json(true);
    if(url.includes('/institutions?'))return json([{institution_id:'a',slug:'ue-lúz-de-américa',is_active:true}]);
    if(url.includes('/roles?'))return json([{role_id:'teacher',name:'teacher'}]);
    if(url.endsWith('/admin/users'))return json({id:'new-profile'});
    return json(null);
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).notificationSent,true);
  const invitation=calls.find(call=>call.url.includes('/invite?'));
  const callback=new URL(new URL(invitation.url).searchParams.get('redirect_to'));
  assert.equal(callback.searchParams.get('slug'),'ue-luz-de-america');
  assert.deepEqual([...callback.searchParams.keys()].sort(),['institution','slug']);
  assert.equal(JSON.parse(invitation.init.body).data.phone,assignmentFixture.phone);
});

test('account creation rechecks membership assignment with the caller token',async()=>{
  const calls=[];
  const response=await handleTenantInvitation(request(),env,async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/user'))return json({id:'actor'});
    if(url.endsWith('/admin_tenant_capabilities'))return json(true);
    if(url.endsWith('/admin_tenant_invitation_recipient'))return json(null);
    if(url.includes('/institutions?'))return json([{institution_id:'a',slug:'school-a',is_active:true}]);
    if(url.includes('/roles?'))return json([{role_id:'teacher',name:'teacher'}]);
    if(url.endsWith('/admin/users'))return json({id:'new-profile'});
    if(url.endsWith('/admin_tenant_prepare_invitation'))return json(null);
    throw new Error('Email transport unavailable');
  });
  assert.deepEqual(await response.json(),{assigned:true,pending:true,notificationSent:false});
  const assignment=calls.find(call=>call.url.endsWith('/admin_tenant_prepare_invitation'));
  assert.equal(assignment.init.headers.Authorization,'Bearer caller-token');
  assert.equal(JSON.parse(assignment.init.body).target_institution_id,'a');
  assert(!calls.some(call=>call.init.method==='DELETE'));
});

test('a rejected assignment cleans up only the newly created account',async()=>{
  const calls=[];
  const response=await handleTenantInvitation(request(),env,async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/user'))return json({id:'actor'});
    if(url.endsWith('/admin_tenant_capabilities'))return json(true);
    if(url.endsWith('/admin_tenant_invitation_recipient'))return json(null);
    if(url.includes('/institutions?'))return json([{institution_id:'a',slug:'school-a',is_active:true}]);
    if(url.includes('/roles?'))return json([{role_id:'teacher',name:'teacher'}]);
    if(url.endsWith('/admin/users'))return json({id:'new-profile'});
    if(init.method==='DELETE')return json(null);
    return json({error:'Role revoked'},403);
  });
  assert.equal(response.status,500);
  assert(calls.some(call=>call.url.endsWith('/admin/users/new-profile') && call.init.method==='DELETE'));
  assert.match((await response.json()).error, /Role revoked/);
});
