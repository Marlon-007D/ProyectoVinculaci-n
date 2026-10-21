"""Pruebas aisladas contra PostgreSQL real. Nunca usa .env ni la base compartida.
Ejecutar: python supabase/tests/run_projects_tests.py
Opcional: PG_BIN apunta a la carpeta bin de PostgreSQL.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
PG = Path(os.environ.get('PG_BIN', r'C:/Program Files/PostgreSQL/18/bin'))
if not PG.exists():
    located = shutil.which('pg_ctl')
    if not located:
        raise SystemExit('Configura PG_BIN con los binarios de PostgreSQL.')
    PG = Path(located).parent
ROOT.joinpath('tmp').mkdir(exist_ok=True)
WORK = Path(tempfile.mkdtemp(prefix='projects-test-', dir=ROOT / 'tmp'))
DATA = WORK / 'pg'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    PORT = sock.getsockname()[1]
FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
ENV = {**os.environ, 'PGCLIENTENCODING': 'UTF8'}

def run(tool, *args, check=True, input=None):
    # PostgreSQL's Windows argv parser can lose accented absolute paths.
    arguments = [str(arg.relative_to(ROOT)) if isinstance(arg, Path) and arg.is_relative_to(ROOT) else str(arg) for arg in args]
    # File handles avoid inherited pipe handles keeping communicate() open on Windows.
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        result = subprocess.run([str(PG / tool), *arguments], cwd=ROOT, env=ENV,
                                input=input.encode('utf-8') if input is not None else None,
                                stdout=stdout, stderr=stderr, creationflags=FLAGS, timeout=60)
        stdout.seek(0); stderr.seek(0)
        result.stdout = stdout.read().decode('utf-8', errors='replace')
        result.stderr = stderr.read().decode('utf-8', errors='replace')
    if check and result.returncode:
        raise AssertionError(result.stderr + result.stdout)
    return result

def sql(statement, role=None, user=None, fails=False):
    prefix = f"SET ROLE {role};" if role else ''
    if user:
        prefix += f"SET request.jwt.claim.sub = '{user}';"
    result = run('psql', '-h', '127.0.0.1', '-p', PORT, '-U', 'project_test', '-d', 'postgres',
                 '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-', input=prefix + statement, check=False)
    if fails:
        assert result.returncode != 0, 'Se aceptó una operación que debía rechazarse: ' + statement
        return result.stderr
    assert result.returncode == 0, result.stderr + '\nSQL: ' + statement
    return result.stdout.strip()

def file(path):
    run('psql', '-h', '127.0.0.1', '-p', PORT, '-U', 'project_test', '-d', 'postgres',
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path)

def ident(n):
    return f'00000000-0000-4000-8000-{n:012d}'

A, B, C, D = [ident(n) for n in range(1, 5)]
ADMIN_A, ADMIN_B, MANAGER_A, VIEWER_A, SUPER = [ident(n) for n in range(11, 16)]

def operation(tenant, action, payload, user=ADMIN_A, fails=False):
    if action=='create_project': payload={'start_date':'2026-10-01','end_date':'2026-12-01',**payload}
    statement = op_sql(tenant, action, payload)
    result = sql(statement, 'authenticated', user, fails)
    return result if fails else json.loads(result)

def op_sql(tenant, action, payload):
    body = json.dumps(payload, ensure_ascii=True).replace("'", "''")
    return f"SELECT public.project_operation('{tenant}', '{action}', '{body}'::jsonb);"

started = False
try:
    print('Preparando PostgreSQL temporal...', flush=True)
    run('initdb', '-D', DATA, '-U', 'project_test', '--auth=trust', '--encoding=UTF8', '--no-locale', '--no-sync')
    run('pg_ctl', '-D', DATA, '-l', WORK / 'postgres.log', '-o', f'-h 127.0.0.1 -p {PORT} -F', '-w', 'start')
    started = True
    print('Aplicando esquema y migraciones en la base temporal...', flush=True)
    sql("""
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
    """)
    file(ROOT / 'database/script.sql')
    file(ROOT / 'database/superadmin.sql')
    # Dependency supplied by Dylan in the shared deployment, absent in the base SQL export.
    sql("""CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM memberships m JOIN roles r USING(role_id) WHERE m.profile_id=auth.uid() AND r.name='super_admin') $$;""")
    sql("DELETE FROM institutions;")
    sql("CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(id uuid DEFAULT uuid_generate_v4(),bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO authenticated,anon; GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated,anon;")
    # Supabase grants are reproduced before the migration to test its revocations.
    sql('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;')
    file(ROOT / 'supabase/migrations/202610110001_projects_multitenant.sql')
    file(ROOT / 'supabase/migrations/202610110001_projects_multitenant.sql')  # Safe rerun.
    for migration in ['202610200001_projects_integrity.sql','202610200002_projects_receipts.sql','202610200003_portal_editor_atomic.sql','202610200004_portal_assets.sql']:
        file(ROOT / 'supabase/migrations' / migration)
        file(ROOT / 'supabase/migrations' / migration)
    print('Verificando cuatro instituciones, permisos y operaciones...', flush=True)
    for index, tenant in enumerate([A, B, C, D], 1):
        sql(f"INSERT INTO institutions(institution_id, name, slug) VALUES('{tenant}', 'Institución de prueba {index}', 'test-{index}');")
        sql(f"INSERT INTO module_settings(institution_id,module_name,is_enabled) VALUES('{tenant}','projects',true),('{tenant}','portal',true);")
    sql("INSERT INTO roles(name) VALUES('institution_admin'), ('project_manager'), ('viewer'), ('super_admin') ON CONFLICT(name) DO NOTHING;")
    for user, tenant, role in [(ADMIN_A, A, 'institution_admin'), (ADMIN_B, B, 'institution_admin'),
                               (MANAGER_A, A, 'project_manager'), (VIEWER_A, A, 'viewer'), (SUPER, A, 'super_admin')]:
        sql(f"""INSERT INTO auth.users(id,email) VALUES('{user}','{user}@example.test');
          INSERT INTO profiles(profile_id, first_name, last_name, email, phone) VALUES('{user}', 'Prueba', '{role}', '{user}@example.test', '0999999999') ON CONFLICT(profile_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,email=EXCLUDED.email,phone=EXCLUDED.phone;
          INSERT INTO memberships(institution_id, profile_id, role_id) SELECT '{tenant}', '{user}', role_id FROM roles WHERE name='{role}';""")
    assert sql('SELECT count(*) FROM project_institutions();', 'authenticated', ADMIN_A) == '1'
    assert sql('SELECT count(*) FROM project_institutions();', 'authenticated', SUPER) == '4'
    assert sql('SELECT count(*) FROM project_public_institutions();', 'anon') == '4'
    project = operation(A, 'create_project', {'name': 'Proyecto A', 'description': 'Objetivo público', 'budget_total': 1000})
    project_id = project['project_id']
    assert project['institution_id'] == A and project['is_public'] is False
    project_b = operation(B, 'create_project', {'name': 'Proyecto B', 'budget_total': 800}, user=ADMIN_B)
    for tenant in [C, D]:
        operation(tenant, 'create_project', {'name': 'Proyecto independiente', 'budget_total': 500}, user=SUPER)
    assert sql('SELECT count(*) FROM projects;', 'authenticated', ADMIN_A) == '1'
    assert sql('SELECT count(*) FROM projects;', 'authenticated', SUPER) == '4'
    for user in [ADMIN_A, MANAGER_A, VIEWER_A]:
        operation(B, 'toggle_status', {'project_id': project_b['project_id']}, user=user, fails=True)
    operation(A, 'create_project', {'name': 'Sin permiso', 'budget_total': 100}, user=VIEWER_A, fails=True)
    operation(A, 'publish', {'project_id': project_id, 'published': True}, user=MANAGER_A, fails=True)
    budget = operation(A, 'add_budget', {'project_id': project_id, 'name': 'Materiales', 'amount': 600})
    expense = operation(A, 'add_expense', {'project_id': project_id, 'budget_item_id': budget['budget_item_id'],
      'amount': 150, 'description': 'Material de prueba', 'date': '2026-10-11', 'invoice_number': 'PRUEBA-001'})
    assert expense['expense_date'] == '2026-10-11'
    assert sql(f"SELECT sum(amount) FROM expenses WHERE budget_item_id='{budget['budget_item_id']}';", 'authenticated', ADMIN_A) == '150.00'
    assert sql(f"SELECT count(*) FROM budget_items WHERE project_id='{project_id}';", 'authenticated', ADMIN_B) == '0'
    assert sql('SELECT count(*) FROM expenses;', 'authenticated', VIEWER_A) == '0'
    operation(A, 'add_budget', {'project_id': project_id, 'name': 'Exceso', 'amount': 401}, fails=True)
    for amount in [-1, 0, 450.01, 0.001, 'NaN']:
        operation(A, 'add_expense', {'project_id': project_id, 'budget_item_id': budget['budget_item_id'],
          'amount': amount, 'description': 'Inválido', 'date': '2026-10-11'}, fails=True)
    operation(A, 'delete_budget', {'project_id': project_id, 'budget_item_id': budget['budget_item_id']}, fails=True)
    operation(B, 'add_expense', {'project_id': project_b['project_id'], 'budget_item_id': budget['budget_item_id'],
      'amount': 1, 'description': 'Cruce', 'date': '2026-10-11'}, user=ADMIN_B, fails=True)
    member = operation(A, 'add_member', {'project_id': project_id, 'full_name': 'Persona ficticia', 'email': 'test@example.test',
      'role': 'Coordinador', 'hours_assigned': 20})
    assert sql(f"SELECT full_name FROM project_members WHERE project_member_id='{member['project_member_id']}';", 'authenticated', ADMIN_A) == 'Persona ficticia'
    assert sql('SELECT count(*) FROM project_members;', 'authenticated', ADMIN_B) == '0'
    # Private tables cannot be read anonymously nor written by bypassing the RPC.
    for table in ['projects', 'budget_items', 'expenses', 'project_members']:
        sql(f'SELECT * FROM {table};', 'anon', fails=True)
    sql(f"UPDATE projects SET total_budget=1 WHERE project_id='{project_id}';", 'authenticated', ADMIN_A, fails=True)
    assert sql("SELECT count(*) FROM project_public_summary('test-1');", 'anon') == '0'
    operation(A, 'publish', {'project_id': project_id, 'published': True})
    public_row = json.loads(sql("SELECT row_to_json(s) FROM project_public_summary('test-1') s;", 'anon'))
    assert float(public_row['spent']) == 150 and float(public_row['balance']) == 850
    assert set(public_row) == {'project_id', 'title', 'description', 'is_active', 'total_budget', 'spent', 'balance'}
    operation(A, 'toggle_status', {'project_id': project_id})
    assert sql("SELECT count(*) FROM project_public_summary('test-1');", 'anon') == '1'
    operation(A, 'publish', {'project_id': project_id, 'published': False})
    assert sql("SELECT count(*) FROM project_public_summary('test-1');", 'anon') == '0'
    # Two connections compete for the remaining 450. The row lock admits only one.
    def spend(amount, delay=0):
        statement = 'BEGIN;' + op_sql(A, 'add_expense', {'project_id': project_id, 'budget_item_id': budget['budget_item_id'],
          'amount': amount, 'description': 'Concurrente', 'date': '2026-10-11'}) + f'SELECT pg_sleep({delay}); COMMIT;'
        try:
            sql(statement, 'authenticated', ADMIN_A)
            return True
        except AssertionError:
            return False
    with concurrent.futures.ThreadPoolExecutor() as pool:
        first = pool.submit(spend, 400, 1)
        time.sleep(0.25)
        second = pool.submit(spend, 100)
        assert sum([first.result(), second.result()]) == 1
    assert float(sql('SELECT sum(amount) FROM expenses;', 'authenticated', ADMIN_A)) <= 600
    print('Verificando edición de rubros, MFA, adjuntos y editor...', flush=True)
    operation(A,'update_budget',{'project_id':project_id,'budget_item_id':budget['budget_item_id'],'name':'Material actualizado','amount':100},fails=True)
    operation(A,'update_budget',{'project_id':project_id,'budget_item_id':budget['budget_item_id'],'name':'Material actualizado','amount':700})
    operation(A,'set_status',{'project_id':project_id,'active':True})
    operation(A,'set_status',{'project_id':project_id,'active':True})
    assert sql(f"SELECT is_active FROM projects WHERE project_id='{project_id}';",'authenticated',ADMIN_A)=='t'
    sql(f"UPDATE profiles SET mfa_required=true WHERE profile_id='{ADMIN_A}';")
    operation(A,'set_status',{'project_id':project_id,'active':False},fails=True)
    sql('SET request.jwt.claims=\'{"aal":"aal2"}\';'+op_sql(A,'set_status',{'project_id':project_id,'active':True}),'authenticated',ADMIN_A)
    sql(f"UPDATE profiles SET mfa_required=false WHERE profile_id='{ADMIN_A}';")
    path=f"{A}/{expense['expense_id']}/receipt-test"
    sql(f"INSERT INTO storage.objects(bucket_id,name) VALUES('project-receipts','{path}');",'authenticated',ADMIN_B,fails=True)
    sql(f"INSERT INTO storage.objects(bucket_id,name) VALUES('project-receipts','{path}');",'authenticated',ADMIN_A)
    sql(f"INSERT INTO expense_files(expense_id,file_path,file_name) VALUES('{expense['expense_id']}','{path}','prueba.pdf');",'authenticated',ADMIN_A)
    assert sql('SELECT count(*) FROM expense_files;','authenticated',ADMIN_B)=='0'
    assert sql("SELECT count(*) FROM storage.objects WHERE bucket_id='project-receipts';",'anon')=='0'
    operation(A,'delete_expense',{'project_id':project_id,'budget_item_id':budget['budget_item_id'],'expense_id':expense['expense_id']},fails=True)
    sql(f"DELETE FROM storage.objects WHERE name='{path}';",'authenticated',ADMIN_A)
    sql(f"DELETE FROM expense_files WHERE file_path='{path}';",'authenticated',ADMIN_A)
    snapshot={'schema_version':1,'title':'Inicio','slug':'inicio','is_homepage':True,'template':'cards',
      'settings':{'site_title':'Colegio A','logo_url':'','footer_text':'Contacto'},
      'theme':{'primary_color':'#112233','secondary_color':'#ddeeff','font_family':'Arial'},
      'menus':[{'label':'Inicio','url':'/'}],'sections':[{'id':'s1','type':'text','position':0,'is_visible':True,'properties':{'body':'Publicado'}}]}
    def save_portal(tenant,page,revision,snapshot,publish,user=ADMIN_A,fails=False):
        value=json.dumps(snapshot).replace("'","''")
        page_sql=f"'{page}'::uuid" if page else 'NULL'
        result=sql(f"SELECT portal_editor_save('{tenant}',{page_sql},{revision},'{value}'::jsonb,{str(publish).lower()});",'authenticated',user,fails)
        return result if fails else json.loads(result)
    draft=save_portal(A,None,0,snapshot,False)
    page=draft['page_id']
    assert sql(f"SELECT count(*) FROM publication_versions WHERE page_id='{page}';")=='0'
    sql('SELECT * FROM portal_editor_drafts;','anon',fails=True)
    save_portal(B,page,1,snapshot,True,user=ADMIN_B,fails=True)
    save_portal(A,page,0,snapshot,True,fails=True)
    published=save_portal(A,page,1,snapshot,True)
    assert published['revision']==2
    snapshot['sections'][0]['properties']['body']='BORRADOR PRIVADO'
    save_portal(A,page,2,snapshot,False)
    assert 'BORRADOR PRIVADO' not in sql(f"SELECT content_snapshot FROM publication_versions WHERE page_id='{page}' ORDER BY version_number DESC LIMIT 1;",'anon')
    assert sql(f"SELECT count(*) FROM portal_editor_drafts WHERE page_id='{page}';",'authenticated',ADMIN_B)=='0'
    # A database error after updating theme must roll back EVERY publication change.
    sql("CREATE FUNCTION reject_test_sections() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced storage failure'; END $$; CREATE TRIGGER reject_test_sections BEFORE INSERT ON page_sections FOR EACH ROW EXECUTE FUNCTION reject_test_sections();")
    snapshot['theme']['primary_color']='#ff0000'
    save_portal(A,page,3,snapshot,True,fails=True)
    assert sql(f"SELECT primary_color FROM themes WHERE institution_id='{A}';")=='#112233'
    assert sql(f"SELECT revision FROM portal_editor_drafts WHERE page_id='{page}';")=='3'
    sql('DROP TRIGGER reject_test_sections ON page_sections;')
    save_portal(A,page,3,snapshot,True)
    sql(f"UPDATE pages SET status='published' WHERE page_id='{page}';",'authenticated',MANAGER_A,fails=True)
    sql(f"UPDATE memberships SET role_id=(SELECT role_id FROM roles WHERE name='editor') WHERE profile_id='{MANAGER_A}';")
    save_portal(A,page,4,snapshot,False,user=MANAGER_A)
    save_portal(A,page,5,snapshot,True,user=MANAGER_A,fails=True)
    # Public branding uploads remain scoped even if a shared permissive policy exists.
    sql("CREATE POLICY test_broad_storage ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);")
    asset_path=f"{A}/{ident(900)}.png"
    insert_asset=f"INSERT INTO storage.objects(bucket_id,name) VALUES('portal-assets','{asset_path}');"
    sql(insert_asset,'authenticated',ADMIN_B,fails=True)
    sql(insert_asset,'authenticated',VIEWER_A,fails=True)
    sql(insert_asset,'anon',fails=True)
    sql(insert_asset,'authenticated',MANAGER_A)
    sql(f"DELETE FROM storage.objects WHERE name='{asset_path}';",'authenticated',ADMIN_A)
    assert sql(f"SELECT count(*) FROM storage.objects WHERE name='{asset_path}';")=='1'
    sql(f"INSERT INTO storage.objects(bucket_id,name) VALUES('portal-assets','{A}/invalid.svg');",'authenticated',ADMIN_A,fails=True)
    sql(f"UPDATE module_settings SET is_enabled=false WHERE institution_id='{A}' AND module_name='portal';")
    sql(insert_asset,'authenticated',ADMIN_A,fails=True)
    sql(f"UPDATE module_settings SET is_enabled=true WHERE institution_id='{A}' AND module_name='portal';")
    sql(f"UPDATE profiles SET mfa_required=true WHERE profile_id='{ADMIN_A}';")
    sql(insert_asset,'authenticated',ADMIN_A,fails=True)
    sql(f"UPDATE profiles SET mfa_required=false WHERE profile_id='{ADMIN_A}';")
    sql('DROP POLICY test_broad_storage ON storage.objects;')
    operation(A, 'delete_member', {'project_id': project_id, 'project_member_id': member['project_member_id']})
    operation(A, 'delete_expense', {'project_id': project_id, 'budget_item_id': budget['budget_item_id'], 'expense_id': expense['expense_id']})
    sql(f"INSERT INTO module_settings(institution_id, module_name, is_enabled) VALUES('{A}', 'projects', false) ON CONFLICT(institution_id,module_name) DO UPDATE SET is_enabled=false;")
    operation(A, 'toggle_status', {'project_id': project_id}, fails=True)
    assert sql('SELECT count(*) FROM projects;', 'authenticated', ADMIN_A) == '0'
    assert sql('SELECT count(*) FROM project_public_institutions();', 'anon') == '3'
    assert int(sql("SELECT count(*) FROM audit_events WHERE action LIKE 'PROJECT_%';")) >= 12
    print('PASS: 4 instituciones; aislamiento RLS; roles; presupuestos; concurrencia; persistencia; publicación; auditoría; módulos deshabilitados.')
finally:
    if started:
        run('pg_ctl', '-D', DATA, '-m', 'fast', '-w', 'stop', check=False)
    print('Evidencias locales:', WORK)
