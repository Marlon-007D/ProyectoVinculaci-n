# Proyectos y transparencia: diseño del portal y acceso de develop

Este módulo integra gestión de proyectos, rubros, gastos, comprobantes privados, participantes, informe financiero y transparencia pública. El editor institucional está en `../portal-editor`.

## Rutas

- `/panel/proyectos` o `/proyectos`: gestión institucional.
- `/proyectos?transparency=1&institution=<slug>`: resúmenes públicos aprobados.
- `/panel/portal`: editor institucional.
- `/?institution=<slug>&slug=<pagina>`: página publicada en el portal del equipo. Los enlaces antiguos de `/portal` redirigen aquí.

La estructura visual procede de `feature/portal-publico`; el acceso y contrato institucional proceden de `develop`. Administración, proyectos y editor reutilizan `PrivateWorkspace` y `InstitutionSessionLayout`. La transparencia se integra en el encabezado, pie y secciones del portal público de Axel.

## Acceso

Proyectos y el editor consumen directamente `core/AuthContext` y `core/TenantContext`. No hay formulario, proveedor de sesión ni verificación TOTP propios. Sin sesión, se vuelve a `/login`, el acceso institucional compartido, conservando el destino solicitado.

Roles, membresías activas y módulos proceden del proveedor compartido y del servidor. Se reconocen los nombres actuales `projects_manager` y `content_editor`, además de sus alias anteriores. Las operaciones privadas siguen sujetas a RLS/RPC.

Para probar sin segundo factor: `VITE_LOCAL_PASSWORD_ONLY=true` en `.env.local`. Solo actúa con Vite en desarrollo y hostname localhost, 127.0.0.1 o [::1]. No elimina factores de cuentas ni modifica políticas remotas. Si el backend exige MFA para una operación, seguirá rechazándola; el responsable de pruebas debe configurar esa cuenta en un entorno de pruebas.

## Base de datos pendiente

Los SQL están en `supabase/proposals/projects/`, fuera de las migraciones activas de Drizzle. Requieren el contrato institucional previo del equipo y revisión de su integración. **La compilación y publicación del código no habilitan por sí solas los guardados.** Consultar el README de propuestas y su preflight; no importar el esquema antiguo en bloque.

## Verificación

Con las dependencias del lockfile de develop:

```powershell
npm ci --ignore-scripts
npm run build
npm run test:security
npm run test:projects
npm run test:integration
```

Las pruebas cubren contratos de servicios, fechas/importes, filtros, datos públicos, borradores, sesión compartida, aliases de roles, navegación, galería y plantillas del renderizador público. Las pruebas del antiguo adaptador de sesión se sustituyeron por las del acceso compartido.

`supabase/tests/run_projects_tests.py` prueba los SQL en PostgreSQL local desechable. Requiere `PG_BIN` si PostgreSQL no está en la ubicación predeterminada y dos fixtures explícitos: `PROJECT_TEST_SCHEMA` y `PROJECT_TEST_SECURITY`, con el esquema institucional compatible y sus políticas. No contiene credenciales, no usa `.env` y no se conecta a Supabase. Los fixtures de la rama de origen se utilizaron solo para la comprobación local y no se copiaron al esquema del equipo.

El usuario confirmó que el diseño coincide con el equipo. Sigue pendiente aplicar las propuestas SQL y comprobar las nuevas ediciones y retiradas contra la base compartida. Consultar `INTEGRACION_LOCAL.md` para el recorrido y los límites de la validación.

## Lectura de los indicadores

Cada proyecto calcula sus saldos con rubros y gastos vigentes. Los retirados se conservan, pero no suman en los informes. Archivados tiene su filtro y permite restaurar proyectos sin publicarlos automáticamente. Transparencia incluye solo resúmenes aprobados. La ejecución financiera mide gastos registrados, no avance de actividades. Participantes, gastos individuales y comprobantes no forman parte de la respuesta pública.
