import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixtureSQL, id } from './mocks/tenantFixture.mjs';

const fallback = new URL('../../../../tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url);
let PGlite;
try { ({ PGlite } = await import('@electric-sql/pglite')); }
catch { ({ PGlite } = await import(process.env.PGLITE_TEST_MODULE ? pathToFileURL(process.env.PGLITE_TEST_MODULE).href : fallback.href)); }

test('tenant Super Admin hierarchy and PostgreSQL authorization', async t => {
  const db = new PGlite();
  try {
    await db.exec(fixtureSQL);
    const labels = (await readFile(new URL('./001_role_labels.sql', import.meta.url), 'utf8')).replace(/^--.*$/gm, '').split(';').filter(item => item.trim());
    for (const statement of labels) await db.exec(statement);
    await db.exec(await readFile(new URL('./002_tenant_admin.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('./004_delete_tenant_member.sql', import.meta.url), 'utf8'));
    async function asUser(user, sql, args = []) {
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(user)]);
      try { return (await db.query(sql, args)).rows; }
      finally { await db.exec('RESET ROLE'); }
    }
    const snapshot = (user, tenant) => asUser(user, 'SELECT admin_tenant_snapshot($1) result', [id(tenant)]);
    const teacherRole = (await db.query("SELECT role_id FROM roles WHERE name::text='teacher'")).rows[0].role_id;
    const assign = (user, tenant, email, roleId, modules = []) => asUser(user,
      'SELECT admin_tenant_assign_role($1,$2,$3,$4,$5,$6,$7)', [id(tenant),email,roleId,'Cuenta','Prueba','0991234567',modules]);

    await t.test('both institutions have autonomous Super Admins', async () => {
      for (const [actor, tenant] of [[1,100],[2,101]]) {
        const result = (await snapshot(actor,tenant))[0].result;
        assert.equal(result.actor_role,'super_admin');
        assert(result.members.every(member => member.institution_id === id(tenant)));
        assert(result.roles.every(role => role.name === 'institution_admin'));
      }
      await assert.rejects(snapshot(1,101),/permisos/);
      await assert.rejects(snapshot(2,100),/permisos/);
    });
    await t.test('a global legacy read policy cannot expose another institution', async () => {
      const members = await asUser(1,'SELECT * FROM memberships');
      assert(members.every(member => member.institution_id === id(100) || member.profile_id === id(1)));
      const profiles = await asUser(1,'SELECT * FROM profiles');
      assert(!profiles.some(profile => profile.profile_id === id(4)));
      await assert.rejects(asUser(1,'SELECT assign_institution_role()'),/permission denied/);
      await assert.rejects(asUser(1,'UPDATE memberships SET is_active=false WHERE institution_id=$1',[id(101)]),/row-level security|permission/);
    });
    await t.test('Super Admin assigns administrators only in its own institution', async () => {
      await assign(1,100,'nuevadmin@example.test',id(201));
      await assert.rejects(assign(1,101,'nuevadmin@example.test',id(201)),/No puedes/);
      await assert.rejects(assign(1,100,'docentea@example.test',teacherRole),/No puedes/);
      await assert.rejects(assign(1,100,'solicitante@example.test',id(200)),/No puedes/);
      await assert.rejects(assign(3,100,'solicitante@example.test',id(201)),/No puedes/);
    });
    await t.test('administrators assign internal roles and enabled modules only in their own institution', async () => {
      await assign(3,100,'docentea@example.test',teacherRole,['simuladores']);
      const grants = await asUser(5,'SELECT * FROM admin_tenant_own_module_grants()');
      assert.deepEqual(grants,[{institution_id:id(100),module_name:'simuladores'}]);
      await assert.rejects(assign(3,101,'solicitante@example.test',teacherRole),/No puedes/);
      await assert.rejects(assign(3,100,'docentea@example.test',teacherRole,['projects']),/habilitado/);
      await assert.rejects(assign(3,100,'supera@example.test',teacherRole),/autoridad superior/);
      await assert.rejects(assign(3,100,'admina@example.test',teacherRole),/propio rol/);
    });
    await t.test('request approval is atomic and cannot cross institution boundaries', async () => {
      await assert.rejects(asUser(3,'SELECT admin_tenant_approve_request($1,$2,$3,$4)',[id(100),id(301),teacherRole,[]]),/solicitud/);
      await asUser(3,'SELECT admin_tenant_approve_request($1,$2,$3,$4)',[id(100),id(300),teacherRole,['simuladores']]);
      assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1',[id(300)])).rows[0].status,'approved');
      await assert.rejects(asUser(3,'SELECT admin_tenant_approve_request($1,$2,$3,$4)',[id(100),id(300),teacherRole,[]]),/pendiente/);
    });
    await t.test('removal preserves other institutions and rejects authority escalation', async () => {
      await assert.rejects(asUser(3,'SELECT admin_tenant_remove_role($1,$2)',[id(100),id(1)]),/No puedes/);
      await assert.rejects(asUser(1,'SELECT admin_tenant_remove_role($1,$2)',[id(101),id(4)]),/No puedes/);
      await asUser(1,'SELECT admin_tenant_remove_role($1,$2)',[id(100),id(7)]);
      assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(101),id(4)])).rows[0].is_active,true);
    });
    await t.test('an institution cannot acquire a second active Super Admin', async () => {
      await assert.rejects(db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[id(100),id(6),id(200)]),/Super Admin activo/);
    });
    await t.test('member deletion rejects self, higher roles and other institutions, preserving the Auth account', async () => {
      await assert.rejects(asUser(1,'SELECT admin_tenant_delete_member($1,$2)',[id(100),id(1)]),/No puedes/);
      await assert.rejects(asUser(3,'SELECT admin_tenant_delete_member($1,$2)',[id(100),id(1)]),/No puedes/);
      await assert.rejects(asUser(3,'SELECT admin_tenant_delete_member($1,$2)',[id(100),id(3)]),/No puedes/);
      await assert.rejects(asUser(1,'SELECT admin_tenant_delete_member($1,$2)',[id(101),id(4)]),/No puedes/);
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)',[id(101),id(7),id(201)]);
      await asUser(1,'SELECT admin_tenant_delete_member($1,$2)',[id(100),id(7)]);
      assert.equal((await db.query('SELECT * FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(100),id(7)])).rows.length,0);
      assert.equal((await db.query('SELECT is_active FROM memberships WHERE institution_id=$1 AND profile_id=$2',[id(101),id(7)])).rows[0].is_active,true);
      assert.equal((await db.query('SELECT id FROM auth.users WHERE id=$1',[id(7)])).rows.length,1);
      await asUser(3,'SELECT admin_tenant_delete_member($1,$2)',[id(100),id(5)]);
      assert.equal((await db.query('SELECT * FROM admin_tenant_member_modules WHERE institution_id=$1 AND profile_id=$2',[id(100),id(5)])).rows.length,0);
    });
  } finally { await db.close(); }
});
