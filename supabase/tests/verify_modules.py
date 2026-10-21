"""Verifica los módulos institucionales sin desactivar sparse-checkout ni leer .env.

Uso: py supabase/tests/verify_modules.py [--database]
Requiere las dependencias npm instaladas en la raíz. --database usa PostgreSQL local.
"""
import argparse
import io
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--database', action='store_true')
parser.add_argument('--prepare-only', action='store_true', help='Prepara la copia local sin ejecutar pruebas.')
args = parser.parse_args()
target = root / 'tmp' / 'verify-modules'
target.mkdir(parents=True, exist_ok=True)
archive = subprocess.run(['git', 'archive', '--format=zip', 'HEAD'], cwd=root,
                         capture_output=True, check=True).stdout
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    bundle.extractall(target)
for directory in ['src/modules/projects', 'src/modules/portal-editor', 'supabase/tests', 'supabase/migrations']:
    for source in (root / directory).rglob('*'):
        if source.is_file():
            destination = target / source.relative_to(root)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)

if args.prepare_only:
    print('Copia local preparada para probar proyectos y editor institucional.')
    sys.exit(0)

def run(command):
    print('Ejecutando:', ' '.join(map(str, command)), flush=True)
    subprocess.run([str(part) for part in command], cwd=target, check=True)

run(['node', '--test', '--test-isolation=none', 'supabase/tests/frontend_projects.test.cjs'])
run(['node', root / 'node_modules/typescript/bin/tsc', '-b'])
run(['node', root / 'node_modules/vite/bin/vite.js', 'build'])
if args.database:
    run([sys.executable, 'supabase/tests/run_projects_tests.py'])
print('Verificación completada. La vista parcial del repositorio sigue intacta.')
