import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixtureSQL, id } from './mocks/tenantFixture.mjs';
const fallback = new URL('../../../../tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url);
const { PGlite } = await import(process.env.PGLITE_TEST_MODULE ? pathToFileURL(process.env.PGLITE_TEST_MODULE).href : fallback.href);
const roles = ['institution_admin', 'teacher', 'secretary', 'staff', 'dece', 'projects_manager', 'content_editor', 'student'];

test('deferred role defaults survive invitation, acceptance, edits and snapshot reads in four institutions', async () => {
  const db = new PGlite();
  try {
    await db.exec(fixtureSQL);
    await db.exec("ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz DEFAULT now(); ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}'::jsonb");
    for (const label of (await readFile(new URL('./001_role_labels.sql', import.meta.url), 'utf8')).replace(/^--.*$/gm,'').split(';').filter(value => value.trim())) await db.exec(label);
    for (const file of ['002_tenant_admin.sql','006_pending_invitations.sql','007_existing_user_invitations.sql','008_guest_role_label.sql','009_registration_requests.sql','010_access_modules.sql','011_dece_role_access.sql','012_role_default_modules.sql']) await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
    for (const [index,role] of ['dece','projects_manager','content_editor'].entries()) await db.query('INSERT INTO roles VALUES($1,$2::text::user_role_type)',[id(850+index),role]);
    async function asUser(actor,sql,args=[]) {
      await db.exec('SET ROLE authenticated'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor]);
      try { return (await db.query(sql,args)).rows; } finally { await db.exec('RESET ROLE'); }
    }
    for (let school=0;school<4;school++) {
      const tenant=id(450+school), admin=id(650+school);
      await db.query('INSERT INTO institutions VALUES($1,$2,$3,true)',[tenant,`Unidad ${school}`,`school-${school}`]);
      await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[admin,`${admin}@example.test`]);
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[tenant,admin,id(201)]);
      for (const module of ['inicio','dece','projects','portal']) await db.query('INSERT INTO module_settings VALUES($1,$2,true)',[tenant,module]);
      for (const [index,module] of ['dece','projects','portal'].entries()) {
        const person=id(1700+school*10+index), email=`person-${school}-${index}@example.test`;
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[person,email]);
        await asUser(admin,'SELECT admin_tenant_prepare_invitation($1,$2,$3,$4,$5,$6,$7)',[tenant,email,id(850+index),'Ana','Torres','0991234567',['inicio']]);
        const snapshot=(await asUser(admin,'SELECT admin_tenant_snapshot_v4($1) data',[tenant]))[0].data;
        const member=snapshot.members.find(row=>row.profile_id===person);
        assert.deepEqual(member.modules.sort(),['inicio',module].sort());
        assert.deepEqual(await asUser(person,'SELECT * FROM admin_tenant_own_module_grants()'),[]);
        await asUser(person,'SELECT admin_tenant_accept_invitation($1)',[tenant]);
        const grants=await asUser(person,'SELECT * FROM admin_tenant_own_module_grants()');
        assert(grants.some(row=>row.institution_id===tenant && row.module_name===module));
        assert(!grants.some(row=>row.institution_id!==tenant));
        await asUser(admin,'SELECT admin_tenant_update_access($1,$2,$3,$4,$5,$6,$7)',[tenant,email,id(850+index),'Ana','Torres','0991234567',[]]);
        const edited=(await asUser(admin,'SELECT admin_tenant_snapshot_v4($1) data',[tenant]))[0].data.members.find(row=>row.profile_id===person);
        assert.deepEqual(edited.modules,[module]);
        const applicant=id(1900+school*10+index);
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[applicant,`applicant-${school}-${index}@example.test`]);
        await db.query("INSERT INTO memberships SELECT $1,$2,role_id,false FROM roles WHERE name::text='guest'",[tenant,applicant]);
        await asUser(admin,'SELECT admin_tenant_approve_registration($1,$2,$3,$4,$5,$6,$7,$8)',[tenant,applicant,applicant,id(850+index),'Ana','Torres','0991234567',['inicio']]);
        const approved=(await asUser(admin,'SELECT admin_tenant_snapshot_v4($1) data',[tenant]))[0].data.members.find(row=>row.profile_id===applicant);
        assert.equal(approved.is_active,true);
        assert.deepEqual(approved.modules.sort(),['inicio',module].sort());
      }
    }
  } finally { await db.close(); }
});

test('DECE grants follow only the authenticated active institutional role and enabled module', async () => {
  const db = new PGlite();
  try {
    await db.exec(fixtureSQL);
    for (const label of (await readFile(new URL('./001_role_labels.sql', import.meta.url), 'utf8')).replace(/^--.*$/gm, '').split(';').filter(value => value.trim())) await db.exec(label);
    await db.exec(await readFile(new URL('./002_tenant_admin.sql', import.meta.url), 'utf8'));
    await db.query("INSERT INTO roles VALUES($1,'dece_staff')", [id(203)]);
    await db.query('UPDATE memberships SET role_id=$1 WHERE profile_id=$2 AND institution_id=$3', [id(203), id(5), id(100)]);
    await db.query("INSERT INTO module_settings VALUES($1,'dece',true)", [id(100)]);
    await db.exec(await readFile(new URL('./011_dece_role_access.sql', import.meta.url), 'utf8'));
    async function grants() {
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(5)]);
      try { return (await db.query('SELECT * FROM admin_tenant_own_module_grants()')).rows; } finally { await db.exec('RESET ROLE'); }
    }
    assert.deepEqual(await grants(), [{ institution_id: id(100), module_name: 'dece' }]);
    await db.query('UPDATE memberships SET is_active=false WHERE profile_id=$1 AND institution_id=$2', [id(5), id(100)]);
    assert.deepEqual(await grants(), []);
  } finally { await db.close(); }
});

test('all assignable roles preserve pending identity, selected modules and tenant isolation through acceptance in four schools', async () => {
  const db = new PGlite();
  try {
    await db.exec(fixtureSQL);
    await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz DEFAULT now()');
    for (const label of (await readFile(new URL('./001_role_labels.sql', import.meta.url), 'utf8')).replace(/^--.*$/gm, '').split(';').filter(value => value.trim())) await db.exec(label);
    for (const file of ['002_tenant_admin.sql', '006_pending_invitations.sql', '007_existing_user_invitations.sql']) await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
    for (const [index, role] of roles.entries()) {
      await db.query('INSERT INTO roles SELECT $1,$2::text::user_role_type WHERE NOT EXISTS(SELECT 1 FROM roles WHERE name::text=$2::text)', [id(800 + index), role]);
    }
    async function asUser(user, sql, args = []) {
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
      try { return (await db.query(sql, args)).rows; } finally { await db.exec('RESET ROLE'); }
    }
    for (let school = 0; school < 4; school++) {
      const tenant = id(400 + school), owner = id(500 + school), admin = id(600 + school);
      await db.query('INSERT INTO institutions VALUES($1,$2,$3,true)', [tenant, `Unidad ${school}`, `school-${school}`]);
      for (const [user, role] of [[owner, 'super_admin'], [admin, 'institution_admin']]) {
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [user, `${user}@example.test`]);
        await db.query('INSERT INTO memberships SELECT $1,$2,role_id,true FROM roles WHERE name::text=$3 LIMIT 1', [tenant, user, role]);
      }
      await db.query("INSERT INTO module_settings VALUES($1,'projects',true),($1,'simuladores',true)", [tenant]);
      assert.equal((await asUser(owner, 'SELECT admin_tenant_actor_role($1) role', [tenant]))[0].role, 'super_admin');
      await assert.rejects(asUser(admin, 'SELECT admin_tenant_prepare_invitation($1,$2,$3,$4,$5,$6,$7)', [tenant, `${owner}@example.test`, id(200), 'Owner', 'School', '0991234567', []]));
      for (const [index, role] of roles.entries()) {
        const recipient = id(1000 + school * 20 + index), email = `invite-${school}-${role}@example.test`;
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [recipient, email]);
        await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)', [id(101), recipient, id(202)]);
        const roleId = (await db.query('SELECT role_id FROM roles WHERE name::text=$1 LIMIT 1', [role])).rows[0].role_id;
        await asUser(role === 'institution_admin' ? owner : admin,
          'SELECT admin_tenant_prepare_invitation($1,$2,$3,$4,$5,$6,$7)',
          [tenant, email, roleId, 'Persona', 'Invitada', '0991234567', ['projects', 'simuladores', 'projects']]);
        assert.equal((await asUser(recipient, 'SELECT admin_tenant_actor_role($1) role', [tenant]))[0].role, null);
        assert.deepEqual(await asUser(recipient, 'SELECT * FROM admin_tenant_own_module_grants()'), []);
        const own = (await asUser(recipient, 'SELECT admin_tenant_own_invitation($1) data', [tenant]))[0].data;
        assert.equal(own.profile.phone, '0991234567');
        assert.equal(own.email, email);
        assert.equal(own.membership.roles.name, role);
        await assert.rejects(asUser(recipient, 'SELECT admin_tenant_accept_invitation($1)', [id(101)]));
        await asUser(recipient, 'SELECT admin_tenant_accept_invitation($1)', [tenant]);
        assert.equal((await asUser(recipient, 'SELECT admin_tenant_actor_role($1) role', [tenant]))[0].role, role);
        const grants = await asUser(recipient, 'SELECT * FROM admin_tenant_own_module_grants() ORDER BY module_name');
        assert.deepEqual(grants, [{ institution_id: tenant, module_name: 'projects' }, { institution_id: tenant, module_name: 'simuladores' }]);
        assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2', [id(101), recipient])).rows[0].is_active, true);
      }
    }
  } finally { await db.close(); }
});
