# Historial oficial y orden de aplicación

La base compartida de Supabase es la referencia oficial. Estos archivos son
propuestas versionadas hasta contrastarlos con su catálogo y registro remoto.
No ejecutar `db reset`, `db push --include-all` ni `migration repair` para ocultar
una divergencia. No editar migraciones ya aplicadas en el proyecto compartido.

Para una base **nueva**: `database/script.sql`, `database/superadmin.sql` y luego
las migraciones de esta carpeta en orden de nombre. Para una base existente,
auditar primero; no volver a ejecutar el script de creación de tablas.

| Versión | Alcance local |
| --- | --- |
| 20261014180000 | Teléfono y asignación de roles |
| 20261014190000 | MFA con teléfonos históricos |
| 20261014200000 | Configuración de módulos |
| 20261014210000 | Listado institucional de membresías |
| 20261020100000 | Aislamiento core, membresías activas, menús, RPC pública |
| 20261020110000 | Buckets media/documents y RLS por tenant |
| 20261020120000 | Permisos service_role y compatibilidad de perfiles para invitaciones |
| 20261020130000 | Administradores institucionales en DECE, aislamiento entre tenants |
| 20261020140000 | Asignacion institucional, reactivacion y proteccion de roles administrativos |
| 20261020150000 | Capa RLS restrictiva transversal por tenant, membresia activa y modulo habilitado |
| 20261020160000 | Adaptador de edicion segura de presupuesto y resumen publico de proyectos |

Las migraciones del 20 de octubre se probaron con PostgreSQL 18 local. Las versiones
20261020130000 y 20261020140000 se aplicaron al proyecto compartido tras auditar
sus funciones y politicas. El remoto no tiene tabla schema_migrations: se registran
aqui como SQL ejecutado, sin inventar un historial previo. Las migraciones core
rechazan variantes `institution_memberships` y
`tenant_modules` para no crear contratos paralelos accidentalmente: si existen,
adaptar el SQL a la exportación oficial antes de aplicar.

Las versiones 20261020150000 y 20261020160000 son aditivas y estan listas para
revision y despliegue coordinado. No eliminan tablas, funciones ni politicas de
los modulos: agregan politicas restrictivas `p1_*`, triggers de comprobacion de
membresia y dos RPC con nombres `p1_*`. Se validaron contra politicas permisivas
simuladas, incluidos Proyectos, DECE, Portal Web y Simuladores. Antes de aplicarlas
al proyecto compartido debe ejecutarse el inventario `database/audit_shared_security.sql`
y compararse con el esquema remoto oficial.

## DECE

En esta rama no hay migraciones locales DECE. Las siguientes versiones se
encuentran en la rama de respaldo `backup/arquitectura-admin-completo-20261020`:

| Archivo histórico | Estado en esta rama |
| --- | --- |
| 202610100001_dece_forms.sql | Excluido de ejecución; requiere contraste oficial |
| 202610140001_dece_student_form_updates.sql | Excluido de ejecución; requiere contraste oficial |
| 202610140002_fix_student_answer_rls.sql | Excluido de ejecución; requiere contraste oficial |

No se declaran obsoletos ni aplicados sin evidencia remota. No reimportarlos ni
recrear tablas DECE desde otra rama. Si el remoto contiene estas versiones,
conservar su registro y recuperar sus archivos oficiales exactos en la rama de
integración, no en esta rama administrativa.

## Conciliación pendiente

1. En SQL Editor del proyecto oficial, ejecutar `database/audit_shared_security.sql`.
2. Si existe el ledger, exportar `version, name` de
   `supabase_migrations.schema_migrations`; contrastar con `supabase migration list --linked`.
3. Exportar el esquema remoto (`supabase db dump --linked --schema public,storage`)
   y comparar definiciones, columnas, constraints, funciones y políticas; el
   ledger por sí solo no detecta cambios manuales ni SQL diferente con igual versión.
4. Registrar para cada versión si coincide, diverge o fue aplicada manualmente.
   Resolver cambios con una migración nueva hacia adelante. `migration repair`
   solo procede con evidencia de equivalencia y coordinación con el equipo.
5. Revisar políticas restrictivas existentes de Storage: pueden negar una
   operación que estas políticas permitan. Las permisivas amplias no evaden
   las guardas nuevas. Revisar objetos sin prefijo UUID y enlaces de menús entre
   tenants antes de desplegar. La migración no mueve ni elimina archivos.

Los SELECT públicos de `media` permiten enumerar sus metadatos. `documents` solo
permite SELECT/INSERT a miembros activos; UPDATE/DELETE quedan denegados para
anon/authenticated. No usar upsert para documentos; generar nombres únicos.

> Estado en develop: archivos preservados como referencia hist�rica. El flujo ejecutable de migraciones est� en drizzle/; no ejecutar este contenido directamente.
