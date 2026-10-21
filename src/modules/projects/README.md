# Gestión de proyectos y portal institucional

Alcance contrastado con el plan de trabajo, páginas 3–4, 6 y 8: gestión de proyectos y transparencia; identidad visual y editor administrativo de páginas. El editor está en `src/modules/portal-editor`. No se modifican los módulos de administración, DECE, simuladores ni el renderizador `site` de Axel.

## Funciones

- Proyectos por institución: nombre, objetivos, presupuesto y fechas; estado en ejecución/cerrado.
- Responsables y participantes vinculados a perfiles institucionales, con responsabilidad configurable.
- Rubros: alta, edición y eliminación sin gastos; asignación limitada al presupuesto y nunca inferior a lo ejecutado.
- Gastos: concepto/referencia, fecha, monto y respaldo PDF/JPG/PNG privado de hasta 10 MB. Retirar los respaldos antes de eliminar un gasto.
- Totales calculados en centavos, saldo por proyecto y rubro, porcentaje de ejecución, informe por fecha/rubro, CSV e impresión/PDF.
- Transparencia por institución: solo resúmenes aprobados por un administrador. La respuesta pública contiene nombre, objetivos, estado y totales; no incluye participantes, movimientos detallados ni comprobantes.
- Editor: nombre, carga de logotipo e imágenes (PNG/JPG/WebP, hasta 5 MB), URL HTTPS opcional, colores, tipografía, tres plantillas, menús, portada y secciones ordenables/ocultables, borrador privado, previsualización de escritorio/móvil y publicación.

## Integración y despliegue

Subir el código al repositorio no aplica las migraciones a Supabase ni despliega la aplicación. Dylan debe revisar las migraciones y su integración con las políticas existentes antes del despliegue, como indica el plan.

Prerrequisitos compartidos: `database/script.sql`, `database/superadmin.sql`, Supabase Auth/Storage y la función `public.is_super_admin()` del módulo de seguridad. El export SQL actual no contiene la definición de esta última: el entorno de pruebas reproduce su contrato mediante membresías y roles; el despliegue debe confirmar la implementación de Dylan. No ejecutar de nuevo el esquema base sobre una base existente.

Aplicar por orden, mediante el procedimiento habitual del equipo:

1. `202610110001_projects_multitenant.sql`, solo si no estaba aplicada.
2. `202610200001_projects_integrity.sql`: operaciones atómicas, edición de rubros, participantes, estado, permisos de módulo y comprobación del nivel MFA exigido al perfil.
3. `202610200002_projects_receipts.sql`: bucket privado `project-receipts`, límite de archivos y políticas por institución/gasto. El componente utiliza este bucket; la variable antigua `VITE_PROJECT_RECEIPTS_BUCKET` deja de utilizarse.
4. `202610200003_portal_editor_atomic.sql`: borradores privados y publicación transaccional; preserva borradores anteriores al trasladarlos desde `publication_versions`. Revoca escrituras directas desde el navegador en las tablas del editor: coordinar otros consumidores que escriban en ellas.
5. `202610200004_portal_assets.sql`: bucket público `portal-assets` para logotipos e imágenes autorizadas; carga limitada a editores/administradores de la institución, con módulo habilitado y MFA cuando corresponda. No almacena comprobantes.

Activar explícitamente `projects` y/o `portal` en `module_settings`. Una configuración ausente no concede acceso. Roles: `project_manager` gestiona proyectos; `institution_admin` y `super_admin` también aprueban resúmenes; `editor` guarda borradores del portal y los administradores los publican. Los permisos se comprueban de nuevo en la base de datos.

Los cambios del frontend y las migraciones se deben desplegar juntos. No hay una alternativa que omita las reglas del servidor cuando falta una función o un permiso.

## Verificación reproducible

Para abrir **solo proyectos, transparencia y editor institucional** en `http://127.0.0.1:5173/`:

```powershell
node supabase/tests/serve_modules.mjs
```

Esta entrada local muestra únicamente Gestión de proyectos, Transparencia y Editor institucional. Reutiliza la sesión y permisos compartidos; no modifica la navegación del proyecto integrado. Lee la configuración `.env` de la raíz. Los guardados necesitan las migraciones indicadas arriba.

Con dependencias npm instaladas, incluso con la vista parcial activa:

```powershell
py supabase/tests/verify_modules.py
py supabase/tests/verify_modules.py --database
```

El verificador prepara una copia temporal ignorada por Git en `tmp/verify-modules`, combina el proyecto de HEAD con estos cambios y ejecuta las pruebas y la compilación. No copia `.env`. La opción `--database` crea y cierra una instancia PostgreSQL local temporal; no se conecta a Supabase. `PG_BIN` permite indicar otra instalación de PostgreSQL.

Pruebas automatizadas: importes/fechas, errores de permisos, contratos de servicios, seguridad de enlaces, cuatro instituciones, aislamiento, publicación autorizada, desactivación del módulo, MFA requerido, edición de rubros, gastos simultáneos, adjuntos privados, revisiones obsoletas, borradores y rollback completo de una publicación fallida. El ensayo de Storage reproduce sus tablas y políticas RLS; no sustituye una carga/descarga real a través de la API de Storage.

Antes de entregar al colegio: recorrer en el entorno de integración la creación de proyecto, rubro, gasto, subida/descarga/retiro de archivo, aprobación del resumen y publicación de una página; comprobar teclado y diseño móvil. En esta sesión no hubo navegador automatizable disponible para esa comprobación visual. No se cargaron datos institucionales reales.

La comprobación local incluye 58 pruebas de frontend, TypeScript, compilación de producción y pruebas de PostgreSQL. No certifica la configuración del despliegue remoto. En la consulta remota de solo lectura del 20 de octubre de 2026, `portal_editor_drafts` aún no estaba disponible en la API: aplicar y verificar las migraciones antes de habilitar los guardados del editor.

La entrada `dev/` y `serve_modules.mjs` son herramientas locales. El sitio publicado debe usar la compilación integrada del equipo, sus rutas de aplicación y la configuración del alojamiento para rutas SPA, HTTPS y variables públicas de Supabase. Nunca incluir claves de servicio en el frontend.

## Interfaz de proyectos y transparencia

- Gestión: indicadores institucionales, búsqueda por nombre/objetivo sin distinción de tildes, filtros de estado/visibilidad y orden por nombre, presupuesto o gasto. Los indicadores resumen toda la cartera visible; filtrar no cambia esos totales.
- Detalle: distribución por rubros, saldo, comprobantes desplegables, fichas del equipo y un informe con período/rubro explícitos, CSV e impresión. La ejecución financiera representa gastos registrados, no el avance de actividades. Un proyecto sin presupuesto se identifica como tal.
- Transparencia: consulta exclusivamente los RPC públicos de resúmenes e instituciones; no accede a participantes, gastos individuales ni comprobantes. Incluye tarjetas, tabla comparativa, filtros, enlace para compartir e impresión/PDF. Los indicadores suman todos los proyectos publicados, incluidos los cerrados; el informe indica los filtros de la lista.
- Una consulta pendiente o fallida no se presenta como un saldo de cero. Al cambiar de institución se descartan los resultados de la selección anterior. La fecha de consulta pública es la hora local de lectura, no una fecha de auditoría o actualización del registro.

Este rediseño no añade migraciones ni cambia las reglas de aprobación o de acceso. La revisión visual con navegador, teclado y dispositivos móviles sigue pendiente en el entorno de integración.
