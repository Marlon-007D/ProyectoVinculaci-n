import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixtureSQL, id } from './mocks/tenantFixture.mjs';

const fallback=new URL('../../../../tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url);
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE?pathToFileURL(process.env.PGLITE_TEST_MODULE).href:fallback.href);

test('SQL 005 authorizes scoped hard DELETE without weakening self/Super Admin protections',async t=>{
  const db=new PGlite();
  try {
    await db.exec(fixtureSQL);
    const labels=(await readFile(new URL('./001_role_labels.sql',import.meta.url),'utf8')).replace(/^--.*$/gm,'').split(';').filter(value=>value.trim());
    for(const label of labels)await db.exec(label);
    await db.exec(await readFile(new URL('./002_tenant_admin.sql',import.meta.url),'utf8'));
    const permissions=await readFile(new URL('./005_membership_delete_permissions.sql',import.meta.url),'utf8');
    await db.exec(permissions);
    await db.exec(permissions); // Safe to reapply.
    async function remove(actor,tenant,profile){
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(actor)]);
      try{return (await db.query('DELETE FROM memberships WHERE institution_id=$1 AND profile_id=$2 RETURNING institution_id,profile_id',[id(tenant),id(profile)])).rows;}
      finally{await db.exec('RESET ROLE');}
    }
    await t.test('self, Super Admin, cross-tenant and internal-role deletion attempts affect zero rows',async()=>{
      for(const [actor,tenant,profile] of [[1,100,1],[3,100,3],[3,100,1],[1,101,4],[5,100,3]])assert.deepEqual(await remove(actor,tenant,profile),[]);
    });
    await t.test('Admin deletes an internal membership and its grants without deleting other memberships or Auth',async()=>{
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[id(101),id(5),id(202)]);
      await db.query('INSERT INTO admin_tenant_member_modules VALUES($1,$2,$3)',[id(100),id(5),'simuladores']);
      assert.equal((await remove(3,100,5)).length,1);
      assert.equal((await db.query('SELECT * FROM admin_tenant_member_modules WHERE institution_id=$1 AND profile_id=$2',[id(100),id(5)])).rows.length,0);
      assert.equal((await db.query('SELECT * FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(101),id(5)])).rows.length,1);
      assert.equal((await db.query('SELECT * FROM auth.users WHERE id=$1',[id(5)])).rows.length,1);
    });
    await t.test('Admin deletes another administrator and Super Admin deletes a managed administrator',async()=>{
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[id(100),id(7),id(201)]);
      assert.equal((await remove(3,100,7)).length,1);
      assert.equal((await remove(1,100,3)).length,1);
    });
  }finally{await db.close();}
});
