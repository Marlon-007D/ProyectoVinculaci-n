# SQL pendiente de integración: proyectos y editor

Estos archivos son propuestas del módulo, **no un historial activo de migraciones**. No los ejecuta `npm run db:migrate`, y subirlos al repositorio no cambia Supabase.

El destino usa Drizzle. El módulo fue construido contra el contrato institucional previo del equipo: instituciones, perfiles, membresías, roles, proyectos, gastos y tablas del portal. No se importó ese esquema ni se sustituyeron las migraciones de simuladores.

Antes de habilitar el módulo en un entorno:

1. Ejecutar `preflight.sql` como consulta de solo lectura. Revisar también columnas, claves y políticas con el responsable del esquema institucional; que un nombre exista no garantiza compatibilidad.
2. Confirmar el contrato de autenticación institucional y las funciones `is_super_admin()` y `get_accessible_module_settings()`; no sustituirlas por funciones que concedan permisos por defecto.
3. Traducir o incorporar las propuestas al historial activo conforme al procedimiento del equipo, preservando las tablas y políticas de simuladores. Las propuestas presuponen una base institucional compatible y no deben aplicarse a un esquema vacío.
4. Probar en una base desechable y en integración; revisar especialmente los permisos de Storage y la revocación de escrituras directas de tablas del editor.
5. Respaldar y aprobar el cambio de base de datos por separado del cambio de frontend.

Orden lógico de las propuestas: `202610110001`, `202610200001`, `202610200002`, `202610200003`, `202610200004`, `202610220001`, `202610220002`, `202610220003`. La primera solo se necesita si aún no existe la base funcional del módulo. `202610220001` adapta los roles nuevos y exige membresías activas; presupone `memberships.is_active` del contrato compartido. Las dos últimas completan el CRUD y sustituyen los borrados físicos por conservación de registros.

Propuesta pendiente, sin aplicar: `202610280001_projects_text_limits.sql` agrega `CHECK` de longitud (nombres 120, concepto 150, responsabilidad 80, objetivo 1000) como `NOT VALID`. La revisa Marlon, la aprueba Dylan y se ejecuta después de `APLICAR_CRUD_LOGICO.sql`; no forma parte del consolidado ni de `prepare-projects-crud-upgrade.mjs`. Su primer paso es una consulta de diagnóstico de registros que ya superan los límites.

Propuesta pendiente, sin aplicar: `202610280002_projects_public_summary_dates.sql` hace que el respaldo `project_public_summary` devuelva `start_date` y `end_date` para el período y el aviso «Plazo vencido» de Transparencia. `project_public_page` (`ACTIVAR_TRANSPARENCIA_PAGINADA.sql`) ya devuelve ambas fechas. La revisa Marlon y la aprueba Dylan; la interfaz funciona sin fechas mientras no se aplique.

Para una base que ya tiene las tablas institucionales y el CRUD inicial de proyectos, usar `APLICAR_CRUD_LOGICO.sql`. Instala las dependencias faltantes con `202610220000`, adapta roles con `202610220001`, aplica CRUD e historial con `202610220002` y `202610220003`, y configura imágenes del editor con `202610200004`, todo en una transacción. No exige ejecutar las propuestas intermedias del 20 de octubre. Conserva la función compartida `is_super_admin()` y la configuración MFA. Generarlo con `node scripts/prepare-projects-crud-upgrade.mjs`. `DIAGNOSTICO_CRUD.sql` consulta estructura/permisos; `verificar_crud_logico.sql` consulta capacidades, registros retirados y auditoría después de aplicar. Ninguna de estas dos consultas modifica datos. No usar el manifiesto de `db:backup-public` como respaldo de datos: ese comando solo registra nombres y definiciones del esquema.

El frontend utiliza AuthContext y TenantContext del equipo. Las funciones privadas del backend siguen aplicando `projects_session_verified()`, permisos y habilitación del módulo. La opción local de pruebas sin segundo factor solo afecta a la interfaz de desarrollo; no cambia esta política SQL ni desactiva MFA de cuentas remotas.

El usuario confirmó la ejecución del consolidado actualizado en Supabase con `Success. No rows returned`. El agente no tiene conexión administrativa remota. Siguen pendientes las pruebas del CRUD nuevo desde la sesión real.
