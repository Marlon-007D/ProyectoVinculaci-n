# SQL pendiente de integración: proyectos y editor

Estos archivos son propuestas del módulo, **no un historial activo de migraciones**. No los ejecuta `npm run db:migrate`, y subirlos al repositorio no cambia Supabase.

El destino usa Drizzle. El módulo fue construido contra el contrato institucional previo del equipo: instituciones, perfiles, membresías, roles, proyectos, gastos y tablas del portal. No se importó ese esquema ni se sustituyeron las migraciones de simuladores.

Antes de habilitar el módulo en un entorno:

1. Ejecutar `preflight.sql` como consulta de solo lectura. Revisar también columnas, claves y políticas con el responsable del esquema institucional; que un nombre exista no garantiza compatibilidad.
2. Confirmar el contrato de autenticación institucional y las funciones `is_super_admin()` y `get_accessible_module_settings()`; no sustituirlas por funciones que concedan permisos por defecto.
3. Traducir o incorporar las propuestas al historial activo conforme al procedimiento del equipo, preservando las tablas y políticas de simuladores. Las propuestas presuponen una base institucional compatible y no deben aplicarse a un esquema vacío.
4. Probar en una base desechable y en integración; revisar especialmente los permisos de Storage y la revocación de escrituras directas de tablas del editor.
5. Respaldar y aprobar el cambio de base de datos por separado del cambio de frontend.

Orden lógico de las propuestas: `202610110001`, `202610200001`, `202610200002`, `202610200003`, `202610200004`. La primera solo se necesita si aún no existe la base funcional del módulo.

El adaptador de acceso del frontend exige sesión verificada, nivel MFA cuando corresponda y habilitación explícita del módulo. Si faltan las funciones o tablas, informa del fallo y no concede acceso. La comprobación de `projects_session_verified()` es obligatoria también para el editor. El backend sigue siendo responsable de cada autorización.

Los SQL no se han aplicado a la base remota durante esta integración.
