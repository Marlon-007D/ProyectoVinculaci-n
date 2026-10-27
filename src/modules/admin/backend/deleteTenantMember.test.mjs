import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantMemberDeletion } from './deleteTenantMember.ts';
import { snapshotFixture } from '../userManagement/mocks/tenantManagement.mjs';

const env = {supabaseUrl:'https://backend.example.test',publicKey:'public-test',serviceRoleKey:'server-secret',allowedOrigins:['http://localhost:5173']};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const request = (profile='person',institution='a') => new Request('https://edge.example.test',{method:'POST',headers:{authorization:'Bearer caller-token',origin:'http://localhost:5173'},body:JSON.stringify({institution_id:institution,profile_id:profile})});

test('both institutional managers may delete another administrator in their own school using server credentials', async () => {
  for (const role of ['super_admin','superadmin','institution_admin','admin']) {
    const snapshot = snapshotFixture(); snapshot.actor_role=role; snapshot.members[0].role_name='institution_admin';
    const calls=[];
    const result=await handleTenantMemberDeletion(request(),env,async(url,init)=>{
      calls.push({url,init});
      if(url.endsWith('/user'))return json({id:'actor'});
      if(url.endsWith('/admin_tenant_snapshot'))return json(snapshot);
      return json([{institution_id:'a',profile_id:'person'}]);
    });
    assert.equal(result.status,200);
    assert.deepEqual(await result.json(),{deleted:true,institution_id:'a',profile_id:'person'});
    const deletion=calls.find(call=>call.init.method==='DELETE');
    assert.equal(deletion.init.headers.Authorization,'Bearer server-secret');
    const params=new URL(deletion.url).searchParams;
    assert.equal(params.get('institution_id'),'eq.a'); assert.equal(params.get('profile_id'),'eq.person');
    assert(calls.filter(call=>call.init.method!=='DELETE').every(call=>call.init.headers.Authorization==='Bearer caller-token'));
  }
});

test('self deletion, Super Admin, internal roles and other institutions never reach privileged DELETE', async () => {
  for (const scenario of ['self','super','internal','foreign']) {
    const snapshot=snapshotFixture();
    if(scenario==='super')snapshot.members[0].role_name='super_admin';
    if(scenario==='internal')snapshot.actor_role='teacher';
    const calls=[];
    const result=await handleTenantMemberDeletion(request('person',scenario==='foreign'?'b':'a'),env,async(url,init)=>{
      calls.push({url,init});
      return url.endsWith('/user')?json({id:scenario==='self'?'person':'actor'}):json(snapshot);
    });
    assert.equal(result.status,403);
    assert(calls.every(call=>call.init.method!=='DELETE'));
    assert(calls.every(call=>call.init.headers.Authorization!=='Bearer server-secret'));
  }
});

test('no rows or a failed DELETE never confirms successful removal', async () => {
  for (const response of [()=>json([]),()=>json({error:'Foreign key'},409)]) {
    const result=await handleTenantMemberDeletion(request(),env,async(url)=>{
      if(url.endsWith('/user'))return json({id:'actor'});
      if(url.endsWith('/admin_tenant_snapshot'))return json(snapshotFixture());
      return response();
    });
    assert.equal(result.status,409);
    assert.equal((await result.json()).deleted,undefined);
  }
});
