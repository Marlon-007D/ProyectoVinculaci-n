# Checklist reproducible de smoke tests DECE

Requisitos: llenar `.env` con las credenciales del proyecto Supabase de pruebas y levantar la app con `npm run dev`. Usar exclusivamente las cuentas y filas ficticias indicadas por el proyecto. No usar datos reales de estudiantes.

## Acceso y aislamiento

- [ ] `dece1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; debe abrir el DECE y mostrar solo a Ana Prueba Uno.
- [ ] `dece2@prueba.test`: iniciar sesión en `/ue-puerto-limon/login`; debe abrir el DECE y mostrar solo a Luis Prueba Dos.
- [ ] `dece1@prueba.test`: intentar iniciar sesión en `/ue-puerto-limon/login`; debe cerrar la sesión y mostrar “No tienes acceso a esta institución”.
- [ ] `admin1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; debe abrir el placeholder de administración, sin directorio ni casos DECE.
- [ ] `est1@prueba.test`: iniciar sesión en `/ue-el-esfuerzo/login`; solo debe cargar su ficha vinculada, la ficha general publicada y sus respuestas.
- [ ] Cerrar sesión y recargar; no debe quedar contenido protegido visible.

## Escrituras y documentos

- [ ] `dece1` crea un caso ficticio y lo ve en el historial; `dece2` no debe verlo.
- [ ] `est1` guarda el borrador, lo envía y ya no puede editarlo; `dece1` puede revisarlo y marcarlo como revisado.
- [ ] `est1` abre “Mi historial”, ve sus borradores y envíos, puede abrir sus respuestas y no ve fichas de otra cuenta.
- [ ] `dece1` sube un documento ficticio a `<institution_id>/<archivo>`; `admin1` no puede leerlo.

Registrar cualquier fallo de autorización en `docs/solicitudes-bd.md`; no corregir permisos desde la interfaz.

## Estado en este repositorio

Los casos, historial, documentos y bucket no se pueden ejecutar desde este checkout: no contiene las migraciones base ni la configuración de almacenamiento. El flujo de formularios y autenticación sí compila, pero la ejecución de estos casos requiere `.env`, proyecto de pruebas y las cuentas anteriores.
