# Reparar invitaciones y desplegar la Edge Function

La función ya utilizaba service_role y UPSERT. Ese rol omite RLS, pero necesita
también permisos SQL y un esquema compatible. Sin el error original del proyecto
remoto no se puede confirmar cuál de esas condiciones causó el fallo observado.

## Aplicación

1. En el SQL Editor del proyecto compartido, revisar y ejecutar únicamente
   `supabase/migrations/20261020120000_invitation_profile_permissions.sql`.
   Concede permisos a service_role, asegura la columna mfa_required y refresca
   el caché de PostgREST. No abre políticas para anon/authenticated.
2. Desde la raíz del repositorio, en PowerShell:

```powershell
npx.cmd supabase login
npx.cmd supabase projects list
npx.cmd supabase link --project-ref TU_PROJECT_REF
npx.cmd supabase functions deploy invite-institution-user --project-ref TU_PROJECT_REF
```

No es necesario ejecutar `db push` para desplegar la función. No ejecutar todas
las migraciones pendientes sin conciliar antes el historial compartido.
SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY están disponibles en las funciones
alojadas de Supabase; la clave de servidor no se añade al .env del frontend.

## Verificación

Invitar una cuenta de prueba desde Superadmin. El cliente administrativo usa
siempre la clave de servidor, valida al solicitante y sus permisos antes de enviar
la invitación, hace UPSERT por profile_id y comprueba que el ID devuelto coincida
con el usuario de Auth antes del UPSERT de memberships.

El trigger de Auth puede crear el perfil primero: el UPSERT actualiza la misma
fila sin duplicarla ni cambiar mfa_enabled. Si falla una escritura, la función
conserva la cuenta invitada y devuelve stage/code; volver a asignar el rol al mismo
correo permite usar la RPC existente del panel sin enviar otra invitación.

Si persiste, consultar Edge Functions > invite-institution-user > Logs. El panel
mostrará el código de PostgreSQL/PostgREST sin exponer el detalle de los datos:

| Código habitual | Revisar |
| --- | --- |
| 42501 | Permisos SQL y clave real service_role del proyecto correcto |
| PGRST204 / 42703 | Columna ausente o caché del esquema desactualizado |
| 23502 | Columna NOT NULL adicional sin valor/default en la base oficial |
| 23514 | CHECK o trigger del perfil (por ejemplo teléfono) |
| 23505 | Otra restricción UNIQUE, por ejemplo email de un perfil distinto |
| 23503 | Referencia a Auth, institución o rol inexistente |

No eliminar automáticamente usuarios de Authentication para compensar un error
de perfil o membresía: el correo puede haberse enviado y la cuenta debe poder
recuperarse. El flujo completo Auth/DB no es una transacción única.

Pruebas: `npm run test:invitations` ejecuta el handler real transpilado con clientes
simulados (ocho casos correctos, incluidos administradores institucionales), sin enviar correos ni modificar Supabase.
La migración de permisos también se ejecutó correctamente en PostgreSQL 18 local.
La validación remota requiere
desplegar y repetir la operación en el proyecto compartido.

Actualización del 20 de octubre: la función se desplegó y está ACTIVE, versión 7.
Ver docs/restauracion-dece-invitaciones.md para la restauración DECE y las
correcciones de permisos ya aplicadas en el proyecto compartido.

Referencias oficiales: [despliegue](https://supabase.com/docs/guides/functions/deploy)
y [variables disponibles](https://supabase.com/docs/guides/functions/secrets).
