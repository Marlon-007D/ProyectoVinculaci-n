# Seguridad y aislamiento — Participante 1 (Dylan Sosa)

Implementación local sobre el esquema de la rama administrativa. La planificación
recibida omitía el SQL de menús y la firma RPC; se definieron ambos por petición
del usuario. No se dispone de exportación ni conexión administrativa al proyecto
compartido: no se aplicaron cambios ni se reparó su historial remoto.

Actualización posterior: se consiguió acceso mediante la CLI autenticada y se
aplicaron las correcciones puntuales 20261020130000/140000. Consultar
docs/restauracion-dece-invitaciones.md; la descripción anterior registra el estado
de la entrega inicial, antes de restaurar DECE por petición del usuario.

## Contratos

- Esquema canónico: `profiles.profile_id`, `memberships.profile_id/institution_id`,
  roles `institution_admin` y `super_admin`. No se usan `profiles.id` ni una tabla
  duplicada `institution_memberships`.
- `memberships.is_active` permite revocar acceso; el tenant también debe estar
  activo. Las membresías existentes se inicializan en true. El perfil propio
  sigue visible tras revocación, sin acceso a documentos del tenant.
- Perfiles: lectura propia o de miembros activos de la misma institución;
  Superadmin puede consultar todos para su administración global. Edición propia
  limitada a nombres, apellidos y teléfono. MFA y membresías se modifican mediante
  RPC validadas, sin conceder escritura directa a authenticated.
- Se reemplazan las políticas anteriores en las cinco tablas core afectadas,
  incluidas las dos políticas de lectura global indicadas. La inspección remota
  es necesaria antes de sustituir personalizaciones existentes.
- Menús: padre e hijo deben compartir institución; se rechaza la autorreferencia.
  La FK compuesta reemplaza `fk_menus_parent` y conserva el borrado en cascada.
  Los datos incompatibles abortan la transacción; no se corrigen silenciosamente.
- `get_public_enabled_modules(target_slug text)` devuelve filas `{module_name}`
  para una institución activa. No devuelve `settings`, IDs de usuarios ni datos
  privados. No concede lectura anónima a `module_settings`.

## Storage

| Bucket | Lectura | INSERT | UPDATE / DELETE |
| --- | --- | --- | --- |
| media (público) | anon y authenticated | Admin del tenant o Superadmin | Admin del tenant o Superadmin |
| documents (privado) | Miembro activo del tenant | Miembro activo del tenant | Denegados a clientes |

Prefijo obligatorio: `<institution_id UUID>/<ruta-relativa>`. Usar
`tenantObjectPath()` de `src/core/supabase/storage.ts`; RLS vuelve a verificar
el tenant en el servidor. No se confía en un ID del cliente ni en ser propietario
del objeto. Superadmin requiere membresía activa del tenant para documentos
privados, igual que el resto de usuarios. No basta con conocer su URL.

La pertenencia al tenant permite leer **todos** sus documentos conforme al alcance
solicitado. Este paquete no implementa permisos por expediente o asignación de
caso DECE. Si se exige esa separación interna, añadir autorización por caso antes
de cargar expedientes con ese requisito. Los documentos se descargan autenticados
o con URL firmada de vida corta; nunca con `getPublicUrl`. No registrar URLs
firmadas en Git ni guardarlas permanentemente. Los enlaces ya firmados conservan
su validez hasta expirar; revocar membresía no invalida inmediatamente esos enlaces.

`media` es deliberadamente público: nunca almacenar allí comprobantes ni fichas.
Supabase permite servir objetos de un bucket público sin comprobar RLS de lectura.
No se modifica el estado de buckets distintos de media/documents.

## Cliente público para Axel

Importar `publicSupabase` / `getPublicEnabledModules` desde
`src/core/supabase/publicClient.ts`. No iniciar sesión con ese cliente. Tiene
persistencia, refresco automático y detección de sesión en URL desactivados y
un storageKey distinto. El cliente administrativo sigue en `supabaseClient.ts`.
Ambos usan exclusivamente VITE_SUPABASE_ANON_KEY (anon JWT o sb_publishable_).
La configuración rechaza claves service_role/sb_secret_ en el navegador. Esto
detecta errores de configuración; la autorización efectiva sigue siendo RLS.
La implementación del portal se mantiene fuera de esta rama.

La Edge Function de invitaciones también filtra membresías e instituciones
activas antes de autorizar al solicitante, aunque use service_role en el servidor.
Hay que volver a desplegar esa función después de aplicar la migración core.

## Verificación y despliegue

Los fixtures de `supabase/tests/bootstrap_security.sql` crean roles y emulan
auth.uid/auth.jwt y tablas de Storage únicamente en una base desechable llamada
`security_rls_test`, con propietario `security_test`. Nunca ejecutarlos en Supabase.
En ese entorno ejecutar con psql (ON_ERROR_STOP=1) primero el bootstrap y luego
`supabase/tests/security_rls.sql`. Las pruebas de datos terminan en ROLLBACK.
Se comprueban accesos positivos y negativos entre tenants, revocaciones, permisos
por rol, RPC y políticas antiguas permisivas. El bootstrap reaplica las dos nuevas
migraciones para comprobar idempotencia.

Validación local realizada: 34 comprobaciones SQL correctas en PostgreSQL 18,
3 pruebas de cliente con `npm run test:security-client`, compilación correcta y
lint sin errores (seis advertencias de React ya existentes). Las pruebas de
cliente verifican solicitudes HTTP simuladas: con sesión administrativa activa,
la petición pública sigue enviando la clave anon y no tiene sesión propia.
La Edge Function no se ejecutó en Deno/Supabase en este entorno.

Antes de publicar el frontend, aplicar las migraciones conciliadas: las consultas
de roles ahora filtran `is_active`. Seguir `supabase/migrations/README.md` para la
auditoría oficial. La prueba local no sustituye probar las APIs reales de Storage
(upload, list, download, update, remove y signed URLs) en staging de Supabase.

Referencias: [Storage y RLS](https://supabase.com/docs/guides/storage/security/access-control),
[buckets públicos y privados](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[SECURITY DEFINER y search_path](https://supabase.com/docs/guides/database/functions).
