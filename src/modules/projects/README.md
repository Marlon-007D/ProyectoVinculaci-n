# Proyectos y transparencia: integración en develop

Este módulo integra gestión de proyectos, rubros, gastos, comprobantes privados, participantes, informe financiero y transparencia pública. El editor institucional está en `../portal-editor`.

## Rutas

- `/panel/proyectos` o `/proyectos`: gestión institucional.
- `/proyectos?transparency=1&institution=<slug>`: resúmenes públicos aprobados.
- `/panel/portal`: editor institucional.
- `/portal?institution=<slug>&page=<slug>`: página publicada.

El resto de rutas sigue en `SiteApp`, incluida la portada y el acceso existente a cursos. Los módulos se cargan bajo demanda y sus estilos usan CSS Modules; no importan estilos globales, rutas, administración ni proveedores de la rama anterior.

## Acceso

`integration/ModuleSession` recibe un puerto de acceso; `sessionPort` conecta ese puerto con el cliente Supabase que ya existe en develop. Admite cuentas existentes y verificación TOTP de factores ya configurados. No registra usuarios, crea roles ni implementa administración o enrolamiento MFA.

La identidad se comprueba mediante `auth.getUser()`. Antes de cargar instituciones, la sesión debe superar los requisitos de MFA y `projects_session_verified()`. Roles, membresías y módulos proceden del servidor. Una configuración ausente o un error de consulta no concede permisos. Las operaciones privadas conservan sus verificaciones RLS/RPC. El flujo de autenticación de otros módulos no fue reemplazado.

## Base de datos pendiente

Los SQL están en `supabase/proposals/projects/`, fuera de las migraciones activas de Drizzle. Requieren el contrato institucional previo del equipo y revisión de su integración. **La compilación y publicación del código no habilitan por sí solas los guardados.** Consultar el README de propuestas y su preflight; no importar el esquema antiguo en bloque.

## Verificación

Con las dependencias del lockfile de develop:

```powershell
npm ci --ignore-scripts
npm run build
npm run test:security
node --test --test-isolation=none supabase/tests/frontend_projects.test.cjs
```

La suite del módulo contiene 61 pruebas: contratos de servicios, fechas/importes, filtros, aislamiento de datos públicos, borradores, acceso con identidad verificada/MFA y conservación de rutas de portada/cursos. Se conservan las pruebas de seguridad existentes del equipo. Se retiraron de la suite portada únicamente dos pruebas de `ModuleGate`, que no existe en este develop y no se incorporó a la integración.

`supabase/tests/run_projects_tests.py` prueba los SQL en PostgreSQL local desechable. Requiere `PG_BIN` si PostgreSQL no está en la ubicación predeterminada y dos fixtures explícitos: `PROJECT_TEST_SCHEMA` y `PROJECT_TEST_SECURITY`, con el esquema institucional compatible y sus políticas. No contiene credenciales, no usa `.env` y no se conecta a Supabase. Los fixtures de la rama de origen se utilizaron solo para la comprobación local y no se copiaron al esquema del equipo.

Queda pendiente la validación visual y funcional en navegador y contra el backend de integración. Las pruebas locales no certifican un despliegue productivo.

## Lectura de los indicadores

Los totales de gestión incluyen todos los proyectos visibles. Transparencia incluye solo resúmenes aprobados; los filtros no cambian los totales de la institución. La ejecución financiera mide gastos registrados, no avance de actividades. El saldo no representa una cuenta bancaria. Participantes, gastos individuales y comprobantes no forman parte de la respuesta pública.
