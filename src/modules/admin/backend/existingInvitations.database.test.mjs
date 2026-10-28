import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixtureSQL,id } from './mocks/tenantFixture.mjs';
const fallback=new URL('../../../../tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url);
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE?pathToFileURL(process.env.PGLITE_TEST_MODULE).href:fallback.href);

test('self-registration requests and approved guests are scoped, atomic and separate from email invitations in four schools', async () => {
  const db = new PGlite();
  try {
    await db.exec(fixtureSQL);
    await db.exec("ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz; ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}'::jsonb");
    for (const label of (await readFile(new URL('./001_role_labels.sql', import.meta.url), 'utf8')).replace(/^--.*$/gm, '').split(';').filter(value => value.trim())) await db.exec(label);
    for (const file of ['002_tenant_admin.sql', '006_pending_invitations.sql', '007_existing_user_invitations.sql', '008_guest_role_label.sql', '009_registration_requests.sql', '010_access_modules.sql']) await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
    async function asUser(actor, sql, args = []) {
      await db.exec('SET ROLE authenticated'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(actor)]);
      try { return (await db.query(sql, args)).rows; } finally { await db.exec('RESET ROLE'); }
    }
    const guest = (await db.query("SELECT role_id FROM roles WHERE name::text='guest'")).rows[0].role_id;
    await db.query("INSERT INTO roles VALUES($1,'viewer')", [id(820)]);
    for (const institution of [102, 103]) await db.query('INSERT INTO institutions VALUES($1,$2,$3,true)', [id(institution), `Unidad ${institution}`, `school-${institution}`]);
    for (const institution of [101, 102, 103]) await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)', [id(institution), id(3), id(201)]);
    for (const institution of [100, 101, 102, 103]) {
      await db.query("INSERT INTO module_settings VALUES($1,'inicio',true)", [id(institution)]);
      const person = 1000 + institution;
      await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [id(person), `person${person}@example.test`, { first_name: 'Registro', last_name: 'Autónomo' }]);
      await db.query('INSERT INTO profiles(profile_id,email,first_name,last_name) VALUES($1,$2,$3,$4)', [id(person), `person${person}@example.test`, 'Registro', 'Autónomo']);
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,false)', [id(institution), id(person), id(820)]);
      const snapshot = (await asUser(3, 'SELECT admin_tenant_snapshot_v3($1) data', [id(institution)]))[0].data;
      const request = snapshot.requests.find(row => row.profile_id === id(person));
      assert.equal(request.source, 'registration'); assert.equal(request.phone, '');
      const args = [id(institution), id(person), id(person), guest, 'Registro', 'Autónomo', '0991234567', ['inicio']];
      await assert.rejects(asUser(3, 'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)', [id(institution), id(person), id(person), id(200), 'Registro', 'Autónomo', '0991234567', []]), /aprobar/);
      await assert.rejects(asUser(3, 'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)', [...args.slice(0, 7), ['not-enabled']]), /habilitado/);
      await asUser(3, 'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)', args);
      const refreshed = (await asUser(3, 'SELECT admin_tenant_snapshot_v3($1) data', [id(institution)]))[0].data;
      assert(!refreshed.requests.some(row => row.profile_id === id(person)));
      const member = refreshed.members.find(row => row.profile_id === id(person));
      assert.equal(member.role_name, 'guest'); assert.equal(member.is_active, true); assert.deepEqual(member.modules, ['inicio']);
      const own = (await asUser(person, 'SELECT admin_tenant_own_account($1) data', [id(institution)]))[0].data;
      assert.equal(own, null); // Registration email has not been verified yet.
      await assert.rejects(asUser(3, 'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)', args), /pendiente/);
      assert.equal((await asUser(person, 'SELECT admin_tenant_actor_role($1) role', [id(institution)]))[0].role, 'guest');
    }
    // The explicit access-request table remains supported by the same operation.
    await asUser(3, 'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)', [id(100), id(6), id(300), guest, 'Ana', 'Torres', '0991234567', []]);
    assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1', [id(300)])).rows[0].status, 'approved');
    await asUser(1, 'SELECT admin_tenant_update_access($1,$2,$3,$4,$5,$6,$7)', [id(100), 'admina@example.test', id(201), 'Admin', 'Unidad', '0991234567', ['inicio']]);
    const updated = (await asUser(1, 'SELECT admin_tenant_snapshot_v3($1) data', [id(100)]))[0].data.members.find(member => member.profile_id === id(3));
    assert.deepEqual(updated.modules, ['inicio']);
    await asUser(3, 'SELECT admin_tenant_update_access($1,$2,$3,$4,$5,$6,$7)', [id(100), 'person1100@example.test', id(202), 'Registro', 'Unidad', '0991234567', ['simuladores']]);
    const internal = (await asUser(3, 'SELECT admin_tenant_snapshot_v3($1) data', [id(100)]))[0].data.members.find(member => member.profile_id === id(1100));
    assert.equal(internal.role_name, 'student'); assert.deepEqual(internal.modules, ['simuladores']); assert.equal(internal.is_active, true);
  } finally { await db.close(); }
});

test('existing Auth invitations can be resent and accepted with full institution isolation',async()=>{
  const db=new PGlite();
  try{
    await db.exec(fixtureSQL);
    await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz DEFAULT now()');
    const labels=(await readFile(new URL('./001_role_labels.sql',import.meta.url),'utf8')).replace(/^--.*$/gm,'').split(';').filter(value=>value.trim());
    for(const label of labels)await db.exec(label);
    for(const path of ['./002_tenant_admin.sql','./006_pending_invitations.sql','./007_existing_user_invitations.sql'])await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
    async function asUser(actor,sql,args=[]){
      await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(actor)]);
      try{return (await db.query(sql,args)).rows;}finally{await db.exec('RESET ROLE');}
    }
    const prepare=(actor,tenant,email,role,name='Ana')=>asUser(actor,'SELECT admin_tenant_prepare_invitation($1,$2,$3,$4,$5,$6,$7)',[id(tenant),email,id(role),name,'Torres','0991234567',[]]);
    await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[id(101),id(6),id(202)]);
    await prepare(1,100,'solicitante@example.test',201);
    await prepare(1,100,'solicitante@example.test',201,'Actualizado');
    const memberships=(await db.query('SELECT institution_id,is_active FROM memberships WHERE profile_id=$1 ORDER BY institution_id',[id(6)])).rows;
    assert.deepEqual(memberships,[{institution_id:id(100),is_active:false},{institution_id:id(101),is_active:true}]);
    assert.equal((await db.query('SELECT count(*)::int count FROM admin_tenant_invitations WHERE profile_id=$1',[id(6)])).rows[0].count,1);
    const own=(await asUser(6,'SELECT admin_tenant_own_invitation($1) invitation',[id(100)]))[0].invitation;
    assert.equal(own.profile.first_name,'Actualizado');
    await assert.rejects(prepare(1,101,'solicitante@example.test',201),/invitar/);
    await assert.rejects(prepare(1,100,'supera@example.test',201),/protegida/);
    await assert.rejects(prepare(3,100,'admina@example.test',202),/protegida/);
    await prepare(3,100,'nuevadmin@example.test',202);
    await prepare(3,100,'docentea@example.test',202);
    assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(100),id(5)])).rows[0].is_active,false);
    await asUser(5,'SELECT admin_tenant_accept_invitation($1)',[id(100)]);
    await asUser(7,'SELECT admin_tenant_accept_invitation($1)',[id(100)]);
    await asUser(6,'SELECT admin_tenant_accept_invitation($1)',[id(100)]);
    assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(100),id(6)])).rows[0].is_active,true);
    assert.equal((await db.query('SELECT count(*)::int count FROM auth.users')).rows[0].count,7);
  }finally{await db.close();}
});
