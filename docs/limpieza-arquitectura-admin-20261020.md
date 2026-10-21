# Respaldo y reconstruccion administrativa - 2026-10-20

- Rama original: feature/arquitectura-admin.
- Estado completo respaldado: backup/arquitectura-admin-completo-20261020.
- Commit respaldado: 592b519 (incluye todo su historial).
- Arbol de trabajo original: limpio, sin cambios ni archivos nuevos pendientes.
- Base anterior a integraciones de companeros: 061202a.

Se reconstruyo el historial desde esa base, conservando los archivos actuales de
src/modules/admin, AuthContext, auditoria, estilos, configuracion de Supabase,
SQL de Superadmin, funcion de invitaciones y cuatro migraciones administrativas.
Las pantallas de acceso, recuperacion y MFA se conservaron en App.tsx con rutas
exclusivas de administracion. TenantContext consulta instituciones y membresias
sin depender de project_institutions, perteneciente al modulo de proyectos.

No se incorporaron los historiales ni implementaciones DECE, simuladores,
portal publico, editor de portal o proyectos, sus recursos, pruebas o migraciones.
El SQL base compartido de 061202a permanece como contrato original; los nombres
de modulos y roles son necesarios para la configuracion central de Superadmin.

Los archivos ignorados locales (.env, node_modules, tmp) no se incluyen en ramas
Git. No se han agregado credenciales al respaldo. dist se regenera al compilar.
No se modificaron ramas remotas ni se aplicaron cambios a la base de datos.

Para consultar o recuperar el estado integrado completo:

    git switch backup/arquitectura-admin-completo-20261020

La rama administrativa tiene historial reescrito. Publicarla sobre la rama remota
existente requerira una operacion explicita con --force-with-lease.

## Verificacion

- npm run build: correcto (TypeScript y Vite).
- npm run lint: sin errores; seis advertencias de React en archivos conservados.
- git diff --check: correcto.
- Sin imports ni rutas hacia implementaciones de los modulos retirados.
- No se probaron sesiones reales ni se ejecutaron migraciones en Supabase.
