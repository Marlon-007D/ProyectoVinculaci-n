# Proyectos y editor del portal

Entrega preparada sobre `develop` / `feature/portal-publico` en `61cb939` (22 de octubre de 2026). Conserva el historial de `feature/gestion-proyectos` y los módulos de los compañeros.

## Alcance

- CRUD lógico de proyectos, rubros, gastos, participantes y comprobantes; resumen público de transparencia.
- Editor de páginas existentes, borradores privados, publicación con revisión, contacto, imágenes y vista previa con los componentes del portal público.
- Encabezado común y fijo para las cuatro instituciones. Conserva el nombre y logo de cada una.
- Elimina la tarjeta informativa del encabezado. Proyectos conserva formularios y estado al navegar dentro de la aplicación mediante React Activity; se descarta al cambiar de cuenta o institución, perder acceso o recargar el navegador.
- Ajuste mínimo en AuthContext: renovar la misma sesión no activa una pantalla de carga que destruya formularios. Las consultas de roles y MFA continúan ejecutándose.

Los cambios en `site` conectan el editor y Transparencia con el portal compartido. No se sustituyen cursos, simuladores, DECE, administración, esquema institucional ni sus migraciones. No se incluyen credenciales, copias de la base ni el ajuste MFA de la cuenta de pruebas.

## Base de datos

`supabase/proposals/projects` contiene SQL explícito de integración, no migraciones automáticas. El usuario confirmó la aplicación de `APLICAR_CRUD_LOGICO.sql` y `ACTUALIZAR_EDITOR_PORTAL.sql` en su entorno. Publicar código no vuelve a ejecutar esos archivos. Consultar el README de esa carpeta para otros entornos.

## Verificación

```powershell
npm run test:projects
npm run build
```

Prueba DOM adicional de navegación con el formulario real y renovación de AuthContext (dependencia temporal, fuera del producto):

```powershell
npm install --prefix tmp/project-qa --no-save --no-package-lock jsdom
node supabase/tests/project_session_dom.cjs
```

Las pruebas PostgreSQL requieren los fixtures institucionales compatibles indicados por `PROJECT_TEST_SCHEMA` y `PROJECT_TEST_SECURITY`, `PROJECT_TEST_BASELINE=shared_diagnostic` y PostgreSQL local. Ejecutar `py supabase/tests/run_projects_tests.py`. Crean y destruyen una base temporal; no leen `.env` ni escriben en Supabase remoto.

Las pruebas de cuatro instituciones usan cuentas locales aisladas. La cuenta real del usuario solo tiene acceso a El Esfuerzo; no se le concedieron permisos en otras instituciones. La validación automatizada no sustituye la revisión visual final en navegador.

La integración se comprobó contra el commit de develop indicado arriba. Nuevos cambios remotos pueden requerir otra comprobación antes de fusionar.
