import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantAdminService } from './tenantAdminService.ts';

function setup(response) {
  const calls=[];
  const query={eq:(key,value)=>{calls.push({key,value});return query;},select:async()=>response};
  const service=createTenantAdminService({rpc:async()=>{throw new Error('Unexpected RPC');},functions:{invoke:async()=>{throw new Error('Unexpected Edge call');}},
    from:table=>{calls.push({table});return {delete:()=>{calls.push({delete:true});return query;}}},
  });
  return {service,calls};
}

test('membership DELETE uses both identifiers and never calls an Edge Function or RPC', async () => {
  const {service,calls}=setup({data:[{institution_id:'a',profile_id:'person'}],error:null});
  await service.deleteMember('a','person');
  assert.deepEqual(calls,[{table:'memberships'},{delete:true},{key:'institution_id',value:'a'},{key:'profile_id',value:'person'}]);
});

test('zero rows, RLS errors and cross-tenant responses cannot be mistaken for a successful deletion', async () => {
  for(const result of [{data:[],error:null},{error:{code:'42501',message:'Denied'}},{data:[{institution_id:'b',profile_id:'person'}],error:null}]) {
    const {service}=setup(result);
    await assert.rejects(service.deleteMember('a','person'),/005_membership_delete_permissions/);
  }
});

test('missing tenant or profile prevents any database request', async () => {
  const {service,calls}=setup({});
  await assert.rejects(service.deleteMember('','person'),/Selecciona/);
  await assert.rejects(service.deleteMember('a',''),/Selecciona/);
  assert.deepEqual(calls,[]);
});