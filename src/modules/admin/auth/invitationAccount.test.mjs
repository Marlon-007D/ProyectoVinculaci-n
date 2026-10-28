import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedInvitationDetails, createInvitationAccountService } from './invitationAccount.ts';
import { snapshotFixture } from '../userManagement/mocks/tenantManagement.mjs';

test('invitation details come from the verified profile and institutional membership, not URL metadata',()=>{
  const member=snapshotFixture().members[0];
  const membership={institution_id:'a',is_active:true,roles:{name:member.role_name},institutions:{slug:'school-a'}};
  assert.deepEqual(verifiedInvitationDetails(member,membership,member.email,'a','school-a'),{
    email:member.email,firstName:member.first_name,lastName:member.last_name,phone:member.phone,institutionId:'a',slug:'school-a',role:'teacher',
  });
  for(const changed of [{...membership,institution_id:'b'},{...membership,is_active:false},{...membership,institutions:{slug:'school-b'}}]){
    assert.throws(()=>verifiedInvitationDetails(member,changed,member.email,'a','school-a'),/verificar/);
  }
});

test('acceptance requires the invited verified identity before reading any personal data',async()=>{
  for(const user of [{id:'other',email:'other@example.test',email_confirmed_at:'confirmed'},{id:'person',email:'docente@example.test'}]){
    let reads=0;
    const service=createInvitationAccountService({auth:{getUser:async()=>({data:{user},error:null})},from:()=>{reads++;throw new Error('Unexpected read');}});
    await assert.rejects(service.load('person','a','school-a'),/Confirma/);
    assert.equal(reads,0);
  }
});

test('acceptance resolves accented and canonical slug variants only within the verified institution',()=>{
  const member=snapshotFixture().members[0];
  const membership={institution_id:'a',is_active:false,roles:{name:'teacher'},institutions:{slug:'ue-lúz-de-américa'}};
  assert.equal(verifiedInvitationDetails(member,membership,member.email,'a','ue-luz-de-america',true).phone,member.phone);
  assert.throws(()=>verifiedInvitationDetails(member,membership,member.email,'b','ue-luz-de-america',true),/verificar/);
});

test('server-owned invitation data preloads the original contact even when a profile trigger omitted the phone',async()=>{
  const member=snapshotFixture().members[0];
  const assigned={first_name:member.first_name,last_name:member.last_name,phone:member.phone,email:member.email,institution_id:'a',slug:'school-a'};
  const membership={institution_id:'a',is_active:true,roles:{name:'teacher'},institutions:{slug:'school-a'}};
  const client={rpc:async()=>({data:null,error:null}),auth:{getUser:async()=>({data:{user:{id:'person',email:member.email,email_confirmed_at:'verified',app_metadata:{admin_tenant_invitation:assigned},user_metadata:{phone:'untrusted'}}},error:null})},
    from:table=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:table==='profiles'?{...member,phone:null}:membership,error:null})};return query;},
  };
  const result=await createInvitationAccountService(client).load('person','a','school-a');
  assert.equal(result.phone,member.phone);
  assert.equal(result.email,member.email);
});
