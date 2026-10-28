import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixtureSQL,id } from './mocks/tenantFixture.mjs';
const fallback=new URL('../../../../tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url);
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE?pathToFileURL(process.env.PGLITE_TEST_MODULE).href:fallback.href);

test('pending invitation grants no access until the verified recipient accepts',async()=>{
  const db=new PGlite();
  try{
    await db.exec(fixtureSQL);
    await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz');
    const labels=(await readFile(new URL('./001_role_labels.sql',import.meta.url),'utf8')).replace(/^--.*$/gm,'').split(';').filter(value=>value.trim());
    for(const label of labels)await db.exec(label);
    await db.exec(await readFile(new URL('./002_tenant_admin.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('./006_pending_invitations.sql',import.meta.url),'utf8'));
    async function asUser(actor,sql,args=[]){
      await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(actor)]);
      try{return (await db.query(sql,args)).rows;}finally{await db.exec('RESET ROLE');}
    }
    await asUser(1,'SELECT admin_tenant_prepare_invitation($1,$2,$3,$4,$5,$6,$7)',[id(100),'solicitante@example.test',id(201),'Ana','Torres','0991234567',[]]);
    assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(100),id(6)])).rows[0].is_active,false);
    assert.equal((await asUser(6,'SELECT admin_tenant_actor_role($1) role',[id(100)]))[0].role,null);
    await assert.rejects(asUser(1,'SELECT admin_tenant_assign_role($1,$2,$3,$4,$5,$6,$7)',[id(100),'solicitante@example.test',id(201),'Ana','Torres','0991234567',[]]),/aceptar/);
    assert.equal((await asUser(6,'SELECT admin_tenant_own_invitation($1) invitation',[id(100)]))[0].invitation,null);
    await assert.rejects(asUser(6,'SELECT admin_tenant_accept_invitation($1)',[id(100)]),/confirmado/);
    await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[id(6)]);
    await assert.rejects(asUser(7,'SELECT admin_tenant_accept_invitation($1)',[id(100)]),/pendiente/);
    await assert.rejects(asUser(6,'SELECT admin_tenant_accept_invitation($1)',[id(101)]),/pendiente/);
    const own=(await asUser(6,'SELECT admin_tenant_own_invitation($1) invitation',[id(100)]))[0].invitation;
    assert.equal(own.profile.first_name,'Ana');assert.equal(own.membership.is_active,false);
    const snap=(await asUser(1,'SELECT admin_tenant_snapshot_v2($1) snapshot',[id(100)]))[0].snapshot;
    assert.equal(snap.members.find(member=>member.profile_id===id(6)).invitation_pending,true);
    await asUser(6,'SELECT admin_tenant_accept_invitation($1)',[id(100)]);
    assert.equal((await asUser(6,'SELECT admin_tenant_actor_role($1) role',[id(100)]))[0].role,'institution_admin');
    await assert.rejects(asUser(6,'SELECT admin_tenant_accept_invitation($1)',[id(100)]),/pendiente/);
  }finally{await db.close();}
});
