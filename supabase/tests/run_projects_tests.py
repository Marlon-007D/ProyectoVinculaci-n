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
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
    """)
    file(ROOT / 'database/script.sql')
    file(ROOT / 'database/superadmin.sql')
    # Supabase grants are reproduced before the migration to test its revocations.
    sql('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;')
    file(ROOT / 'supabase/migrations/202610110001_projects_multitenant.sql')
    file(ROOT / 'supabase/migrations/202610110001_projects_multitenant.sql')  # Safe rerun.
    print('Verificando cuatro instituciones, permisos y operaciones...', flush=True)
    for index, tenant in enumerate([A, B, C, D], 1):
        sql(f"INSERT INTO institutions(institution_id, name, slug) VALUES('{tenant}', 'Institución de prueba {index}', 'test-{index}');")
    sql("INSERT INTO roles(name) VALUES('institution_admin'), ('project_manager'), ('viewer'), ('super_admin');")
    for user, tenant, role in [(ADMIN_A, A, 'institution_admin'), (ADMIN_B, B, 'institution_admin'),
                               (MANAGER_A, A, 'project_manager'), (VIEWER_A, A, 'viewer'), (SUPER, A, 'super_admin')]:
        sql(f"""INSERT INTO auth.users VALUES('{user}');
          INSERT INTO profiles(profile_id, first_name, last_name, email) VALUES('{user}', 'Prueba', '{role}', '{user}@example.test');
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
    operation(A, 'delete_member', {'project_id': project_id, 'project_member_id': member['project_member_id']})
    operation(A, 'delete_expense', {'project_id': project_id, 'budget_item_id': budget['budget_item_id'], 'expense_id': expense['expense_id']})
    sql(f"INSERT INTO module_settings(institution_id, module_name, is_enabled) VALUES('{A}', 'projects', false);")
    operation(A, 'toggle_status', {'project_id': project_id}, fails=True)
    assert sql('SELECT count(*) FROM projects;', 'authenticated', ADMIN_A) == '0'
    assert sql('SELECT count(*) FROM project_public_institutions();', 'anon') == '3'
    assert int(sql("SELECT count(*) FROM audit_events WHERE action LIKE 'PROJECT_%';")) >= 12
    print('PASS: 4 instituciones; aislamiento RLS; roles; presupuestos; concurrencia; persistencia; publicación; auditoría; módulos deshabilitados.')
finally:
    if started:
        run('pg_ctl', '-D', DATA, '-m', 'fast', '-w', 'stop', check=False)
    print('Evidencias locales:', WORK)
