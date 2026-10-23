# Registro institucional

## Registro y acceso

Ejecutar como postgres database/repair_auth_signup_triggers.sql en Supabase. Es una copia completa de institutional_registration.sql. Ambos archivos unifican los handlers conocidos de aprovisionamiento en on_auth_user_created, conectado a handle_new_auth_profile. Conservan otros triggers de Auth ajenos a este flujo.

El handler usa SECURITY DEFINER SET search_path = public, pg_temp. Lee first_name, last_name, institution_id y role. El campo registration_institution_id se acepta por compatibilidad. El rol enviado nunca concede permisos internos: la membresía de invitado permanece inactiva.

EXCEPTION WHEN OTHERS revierte las escrituras secundarias y conserva Auth. Se registra solo SQLSTATE. Una cuenta sin perfil o membresía requiere reconciliación administrativa. Las cancelaciones y errores fatales no se capturan. Sin ejecutar este SQL y verificar los logs no puede darse por resuelto el error remoto.

React llama a `register-institution-user`, sin usar `signUp` ni iniciar sesión.
La función crea Auth mediante `admin.createUser` con `email_confirm: false`, sin
enviar correos, y verifica que el trigger guardó una membresía inactiva. En este
esquema `is_active = false` y el rol `viewer`/`guest` representan el estado pendiente.
La página muestra la solicitud enviada y no exige confirmar correo.

El autorregistro envía `role: 'invitado'` como metadata desde el servidor. La
clave física del rol sigue siendo compatible con el catálogo instalado. El SQL
expone `memberships.status` calculado desde `is_active`: `pending` cuando es falso
y `active` cuando es verdadero. Así la aprobación y la retirada conservan el mismo
estado usado por RLS. Reaplicar el script de registro para añadir esa columna en
un despliegue existente. No escribir `status` directamente porque es generado.
El formulario se limpia al completarse y muestra el mensaje de espera de
aprobación. Los banners de error conservan el mensaje de Supabase, incluido el
cuerpo JSON de una respuesta no exitosa de Edge Functions.

## Correo después de la aprobación

Aplicar `database/approval_notifications.sql` después de los scripts de registro
y roles. Añade límites de intentos para el endpoint público y una cola privada
de notificaciones. Un cambio a membresía activa o de rol genera una notificación
en la misma transacción. Los registros pendientes no generan correo.

Desplegar las tres funciones actualizadas:

```powershell
npx.cmd supabase functions deploy register-institution-user --no-verify-jwt
npx.cmd supabase functions deploy notify-approved-member
npx.cmd supabase functions deploy invite-institution-user
```

Configurar en los secretos de Edge Functions `RESEND_API_KEY`,
`APPROVAL_EMAIL_FROM` con un remitente verificado y `APP_SITE_URL` con la URL
oficial de la aplicación. No guardar estas claves en variables `VITE_*`.
La aprobación usa las RPC existentes con la sesión del administrador. El endpoint
de notificación verifica otra vez su alcance institucional antes de confirmar la
cuenta de Auth y enviar el mensaje por Resend. La cola registra `sent_at` y cada
intento usa como clave de idempotencia el ID de la notificación.

Si falla el correo, el rol aprobado se conserva y el panel muestra que el envío
está pendiente. Usar «Reintentar notificación» en esa fila. No volver a registrar
al usuario. Las nuevas invitaciones administrativas tampoco envían correo antes
de guardar el rol. Si no se eligió contraseña, el destinatario puede utilizar
la recuperación por correo de la pantalla de ingreso después de la aprobación.

En Supabase Auth, deshabilitar el registro público directo para impedir que
clientes antiguos sigan llamando a `signUp` y enviando confirmaciones fuera de
este flujo. El endpoint administrativo de registro sigue creando las solicitudes.
Verificar estos ajustes en el entorno de prueba antes del despliegue.

Verificar en un entorno aislado un alta normal y un fallo controlado en perfil o membresía. La cuenta Auth debe conservarse sin permisos nuevos ni escrituras secundarias parciales. Reaplicar el script no debe duplicar triggers. Las pruebas locales no sustituyen esta comprobación remota.

## Gestión descentralizada

Aplicar primero `database/institutional_registration.sql` y después
`database/decentralized_roles.sql`. Desplegar nuevamente la función
`invite-institution-user`. La segunda migración añade `student` al enum en una
transacción separada antes de usarlo. No ejecutar las migraciones históricas.

El catálogo presentado usa Equipo DECE, Gestor de proyectos, Editor de contenidos
y Estudiante. Por compatibilidad con las políticas existentes, las claves físicas
siguen siendo `dece_staff`, `project_manager`, `editor` y `student`. Los contratos
de interfaz normalizan esas claves a `dece`, `projects_manager`, `content_editor`
y `student`. `viewer` inactivo representa Invitado/Pendiente, nunca un permiso
interno. No renombrar valores del enum sin migrar también las políticas de cada módulo.

El Superadmin consulta y asigna únicamente administradores institucionales.
El administrador institucional consulta miembros y solicitudes de su plantel,
aprueba membresías y asigna roles operativos. No puede modificar administradores
ni asignar roles a una cuenta perteneciente exclusivamente a otro plantel.
Retirar un rol conserva la membresía como pendiente e inactiva.

Verificar con sesiones distintas en un entorno de prueba: intentar asignar DECE
como Superadmin, promover a administrador como administrador institucional,
consultar o aprobar una solicitud de otro plantel y modificar un administrador
mediante la RPC de retirada. Todos deben denegarse. Verificar también aprobación
de una solicitud del propio plantel y que el usuario pendiente solo dispone de
enlaces públicos. Las pruebas unitarias locales no sustituyen estas pruebas RLS.

La ruta `/register` crea una cuenta con Supabase Auth y solicita una membresía
en la unidad educativa seleccionada. No permite elegir roles ni concede acceso
privado. La membresía se crea como `invitado`, con `is_active = false`; un
administrador la aprueba mediante el flujo existente de asignación de roles.

Antes de probar el flujo completo, revisar y aplicar únicamente
`database/institutional_registration.sql` en el proyecto Supabase compartido.
El script añade un catálogo público limitado a ID y nombre de instituciones
activas y un trigger de Auth que intenta crear perfil y membresía juntos. Si falla,
revierte ese aprovisionamiento sin cancelar la creación de la cuenta en Auth.
No ejecutar todas las migraciones históricas. Esta integración debe coordinarse
con el responsable del esquema Auth, incluidos los triggers existentes que creen
perfiles o membresías. La selección en metadata es solo una solicitud; las
políticas siguen consultando membresías activas verificadas.

El registro no solicita teléfono. El script permite un teléfono nulo y conserva
la validación del formato cuando se proporciona; la asignación administrativa
sigue exigiendo un celular válido. Configurar en Supabase las URL de retorno
`/panel/admin` de cada entorno y mantener habilitada la confirmación de correo.

Verificar en un entorno de prueba:

1. Registrar un correo nuevo en una institución activa.
2. Confirmar que Auth, perfil y membresía existen y que esta permanece inactiva.
3. Comprobar que la cuenta no puede consultar datos privados ni asignarse roles.
4. Aprobar la membresía desde Usuarios y Roles y verificar el correo con el enlace recibido.
5. Probar una institución inexistente o inactiva y comprobar que conserva la cuenta
   de Auth sin crear perfil ni membresía desde este handler y registra el fallo.
6. Reintentar con un correo existente: no debe crear ni modificar membresías.

No se enviarán correos de prueba ni se modificarán usuarios remotos como parte
de la compilación local.


Corrección del flujo de registro y correo:

- Aplicar `database/institutional_registration.sql` (o su reparación equivalente), después `database/decentralized_roles.sql` y `database/approval_notifications.sql`. El registro requiere el rol `invitado`; los fallos del trigger revierten también la cuenta Auth para permitir reintentar.
- Desplegar las funciones `register-institution-user`, `invite-institution-user` y `notify-approved-member`.
- Configurar `RESEND_API_KEY`, `APPROVAL_EMAIL_FROM` y `APP_SITE_URL`, y permitir el retorno `/panel/admin` en Auth. Mantener habilitada la confirmación de correo.
- El registro usa `admin.createUser` sin enviar correo ni iniciar sesión. Solo después de activar la membresía se genera y envía el enlace de acceso de un solo uso con `generateLink(magiclink)`. No se marca el correo como confirmado desde el servidor.
- Las invitaciones directas permiten acceder con ese enlace sin contraseña inicial. El registro público conserva la contraseña elegida.
- Verificar en staging los escenarios de registro, correo duplicado, aprobación, invitación directa y reintento ante fallo del proveedor.
