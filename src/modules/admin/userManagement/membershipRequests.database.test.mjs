import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { institutionContexts } from './mocks/institutionContexts.ts';

const { PGlite } = await import(process.env.PGLITE_TEST_MODULE ? pathToFileURL(process.env.PGLITE_TEST_MODULE).href : '@electric-sql/pglite');
const root = new URL('../../../../', import.meta.url);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('PostgreSQL: pending requests, tenant isolation and atomic role approval', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
      CREATE TYPE public.user_role_type AS ENUM ('super_admin','institution_admin','dece_staff','project_manager','editor','viewer','student','dece','projects_manager','content_editor');
      CREATE TABLE public.institutions(institution_id uuid PRIMARY KEY, slug text UNIQUE, is_active boolean NOT NULL DEFAULT true);
      CREATE TABLE public.roles(role_id uuid PRIMARY KEY, name public.user_role_type);
      CREATE TABLE public.profiles(profile_id uuid PRIMARY KEY REFERENCES auth.users(id), first_name text, last_name text, email text, phone text, mfa_enabled boolean DEFAULT false, mfa_required boolean DEFAULT false);
      CREATE TABLE public.memberships(profile_id uuid REFERENCES auth.users(id), institution_id uuid REFERENCES public.institutions(institution_id), role_id uuid REFERENCES public.roles(role_id), is_active boolean DEFAULT true, UNIQUE(institution_id,profile_id));
      CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM memberships m JOIN roles r USING(role_id) WHERE m.profile_id=auth.uid() AND m.is_active AND r.name='super_admin') $$;
      CREATE FUNCTION public.has_institution_role(target uuid, expected public.user_role_type[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM memberships m JOIN roles r USING(role_id) WHERE m.profile_id=auth.uid() AND m.institution_id=target AND m.is_active AND r.name=ANY(expected)) $$;
    `);
    await db.exec(await readFile(new URL('supabase/legacy-migrations/20261020140000_institution_role_assignment.sql', root), 'utf8'));
    await db.exec(await readFile(new URL('drizzle/0009_admin_membership_requests.sql', root), 'utf8'));
    for (let n = 1; n <= 9; n++) await db.query('INSERT INTO auth.users VALUES ($1,$2,$3)', [id(n), `account${n}@example.test`, n === 9 ? null : new Date()]);
    await db.exec(`INSERT INTO institutions VALUES ('${id(100)}','colegio-a',true),('${id(101)}','colegio-b',true);
      INSERT INTO roles VALUES ('${id(200)}','institution_admin'),('${id(201)}','project_manager'),('${id(202)}','editor'),('${id(203)}','super_admin'),('${id(204)}','dece_staff'),('${id(205)}','projects_manager'),('${id(206)}','dece'),('${id(207)}','content_editor');
      INSERT INTO memberships VALUES ('${id(1)}','${id(100)}','${id(200)}',true),('${id(2)}','${id(101)}','${id(200)}',true),('${id(6)}','${id(100)}','${id(201)}',false);`);
    async function asUser(user, query, args = []) {
      await db.exec('SET ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(user)]);
      try { return (await db.query(query, args)).rows; }
      finally { await db.exec('RESET ROLE'); }
    }
    const submit = user => asUser(user, 'SELECT public.request_institution_access($1,$2,$3,$4,$5) AS id', [id(100), 'colegio-a', 'Ana', 'Torres', '0991234567']);
    let request;
    await t.test('a request is idempotent and grants no membership or direct writes', async () => {
      request = (await submit(3))[0].id;
      assert.equal((await submit(3))[0].id, request);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM memberships WHERE profile_id=$1', [id(3)])).rows[0].n, 0);
      assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1', [request])).rows[0].status, 'pending');
      await assert.rejects(asUser(3, "UPDATE admin_membership_requests SET status='approved'"), /permission denied/);
    });
    await t.test('unconfirmed accounts and deactivated memberships cannot request access', async () => {
      await assert.rejects(submit(9), /Confirma tu correo/);
      await assert.rejects(submit(6), /ya tiene una membresía/);
      await assert.rejects(asUser(4, 'SELECT request_institution_access($1,$2,$3,$4,$5)', [id(100), 'colegio-b', 'Ana', 'Torres', '0991234567']), /No se encontró/);
    });
    await t.test('RLS and RPCs isolate institutions and other applicants', async () => {
      assert.equal((await asUser(1, 'SELECT * FROM admin_pending_institution_access($1)', [id(100)])).length, 1);
      assert.equal((await asUser(4, 'SELECT * FROM admin_membership_requests')).length, 0);
      assert.equal((await asUser(3, 'SELECT * FROM admin_membership_requests')).length, 1);
      await assert.rejects(asUser(2, 'SELECT * FROM admin_pending_institution_access($1)', [id(100)]), /No tienes permisos/);
      await assert.rejects(asUser(2, 'SELECT approve_institution_access($1,$2)', [request, id(201)]), /No tienes permisos/);
      await db.exec('SET ROLE anon');
      await assert.rejects(db.query('SELECT request_institution_access($1,NULL,$2,$3,$4)', [id(100), 'Ana', 'Torres', '0991234567']), /permission denied/);
      await db.exec('RESET ROLE');
    });
    await t.test('local administrators cannot approve global or administrative roles', async () => {
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [request, id(203)]), /rol institucional válido/);
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [request, id(200)]), /Solo el administrador global/);
    });
    await t.test('self approval and newly global applicants remain protected', async () => {
      const self = (await db.query(`INSERT INTO admin_membership_requests(institution_id,profile_id,first_name,last_name,phone)
        VALUES($1,$2,'Admin','Institucional','0991234567') RETURNING request_id`, [id(100),id(1)])).rows[0].request_id;
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [self,id(201)]), /propia solicitud/);
      const global = (await submit(5))[0].id;
      await db.query('INSERT INTO memberships VALUES($1,$2,$3,true)', [id(5),id(101),id(203)]);
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [global,id(201)]), /cuentas globales/);
      await assert.rejects(submit(5), /cuenta global/);
      const pending = await asUser(1, 'SELECT * FROM admin_pending_institution_access($1)', [id(100)]);
      assert.equal(pending.some(row => row.request_id === global),false);
      await db.query('DELETE FROM admin_membership_requests WHERE request_id=$1', [self]);
    });
    await t.test('approval assigns the selected role and moves the request to a terminal state', async () => {
      await asUser(1, 'SELECT approve_institution_access($1,$2)', [request, id(201)]);
      assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1', [request])).rows[0].status, 'approved');
      assert.equal((await db.query('SELECT role_id FROM memberships WHERE profile_id=$1', [id(3)])).rows[0].role_id, id(201));
      assert.equal((await asUser(1, 'SELECT * FROM admin_pending_institution_access($1)', [id(100)])).length, 0);
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [request, id(202)]), /ya fue revisada/);
    });
    await t.test('assignment failures roll back approval completely', async () => {
      const failed = (await submit(4))[0].id;
      await db.exec(`CREATE FUNCTION reject_test_profile() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.profile_id='${id(4)}' THEN RAISE EXCEPTION 'simulated storage failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_test_profile BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION reject_test_profile();`);
      await assert.rejects(asUser(1, 'SELECT approve_institution_access($1,$2)', [failed, id(202)]), /simulated storage failure/);
      assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1', [failed])).rows[0].status, 'pending');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM memberships WHERE profile_id=$1', [id(4)])).rows[0].n, 0);
    });
    await t.test('the same pending-to-approval flow works for all four public institution contexts', async () => {
      for (const [index, context] of institutionContexts.entries()) {
        await db.query('INSERT INTO institutions VALUES ($1,$2,true)', [context.institution, context.slug]);
        await db.query('INSERT INTO memberships VALUES ($1,$2,$3,true)', [id(1),context.institution,id(200)]);
        const requestId = (await asUser(8, 'SELECT request_institution_access($1,$2,$3,$4,$5) AS id',
          [context.institution,context.slug,'Ana','Torres','0991234567']))[0].id;
        const pending = await asUser(1,'SELECT * FROM admin_pending_institution_access($1)',[context.institution]);
        assert.equal(pending.length,1);
        assert.equal(pending[0].institution_id,context.institution);
        assert.equal(pending[0].request_id,requestId);
        const roleId = [id(205),id(206),id(207),id(201)][index];
        await asUser(1,'SELECT approve_institution_access($1,$2)',[requestId,roleId]);
        assert.equal((await asUser(1,'SELECT * FROM admin_pending_institution_access($1)',[context.institution])).length,0);
        assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1',[requestId])).rows[0].status,'approved');
        assert.equal((await db.query('SELECT role_id FROM memberships WHERE institution_id=$1 AND profile_id=$2',[context.institution,id(8)])).rows[0].role_id,roleId);
      }
    });
    await t.test('the requested seed record is visible to the institution admin and can be approved', async () => {
      const institution = institutionContexts[0].institution;
      await db.query('UPDATE auth.users SET email=$1 WHERE id=$2', ['invitado.prueba@test.com',id(7)]);
      for (let attempt=0; attempt<2; attempt++) {
        await db.query(`INSERT INTO admin_membership_requests(institution_id,profile_id,first_name,last_name,phone,status)
          VALUES($1,$2,'Usuario','Prueba','0991234567','pending') ON CONFLICT(institution_id,profile_id) DO NOTHING`, [institution,id(7)]);
      }
      const rows = await asUser(1,'SELECT * FROM admin_pending_institution_access($1)',[institution]);
      const sample = rows.find(row => row.email === 'invitado.prueba@test.com');
      assert.ok(sample);
      assert.equal(sample.first_name + ' ' + sample.last_name,'Usuario Prueba');
      assert.equal(rows.filter(row => row.profile_id === id(7)).length,1);
      assert.equal(sample.institution_id,institution);
      await asUser(1,'SELECT approve_institution_access($1,$2)',[sample.request_id,id(201)]);
      assert.equal((await db.query('SELECT status FROM admin_membership_requests WHERE request_id=$1',[sample.request_id])).rows[0].status,'approved');
    });
  } finally { await db.close(); }
});
