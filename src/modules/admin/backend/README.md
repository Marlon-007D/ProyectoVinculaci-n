# Administración por institución

### Módulos predeterminados por rol

Aplicar `012_role_default_modules.sql` después de 011. Vincula DECE con `dece`,
Gestor de proyectos con `projects` y Editor de contenidos con `portal`, incluyendo
sus alias. Conserva los módulos seleccionados para los demás roles. Solo otorga
módulos habilitados en la institución activa.

El trigger diferido conserva los valores al terminar las operaciones de invitación,
aprobación y edición; también completa las membresías existentes. El snapshot v4
lee los permisos activos por institución y perfil. El contexto de sesión consulta
esos mismos permisos después de autenticar, también con Google OAuth.

### Contactos inválidos, cuentas existentes y DECE OAuth

El cliente y la Edge Function validan correos con dominios y sufijos alfabéticos,
normalizan espacios/caracteres invisibles y conservan los nombres con tildes. Una
dirección como `persona@espe.edu.ec333333333` se señala y rechaza: no se recorta para
inventar un destinatario. Si el dato original de Auth es incorrecto, debe revisarse
la identidad con el responsable; aprobar una solicitud no cambia el correo de Auth.

La invitación consulta primero `admin_tenant_invitation_recipient`: reutiliza la
cuenta existente, crea Auth solo si no existe y conserva el UPSERT institucional
de 007. Los conflictos concurrentes de creación se resuelven mediante otra consulta
autorizada. Los rechazos de preparación muestran el motivo de SQL en vez de ocultarlo
como un error genérico de creación. Actualizar `admin-tenant-invite` con el paquete
regenerado para aplicar esta validación y resolución de destinatarios.

Aplicar `011_dece_role_access.sql` después de 010 para asociar el rol DECE verificado
a su módulo habilitado. Opera únicamente sobre membresías activas y conserva el
aislamiento institucional. El contexto Auth adapta `dece` a `dece_staff`, identificador
que consumen las rutas y la barra lateral existentes. El Login y los enlaces de Admin
usan `/panel/dece` conservando `institution` y `slug`. No se concede acceso por el
correo de Google ni por metadatos; se exige la misma membresía activa de Auth.uid().

### Guardado de módulos y notificaciones de acceso

Aplicar `010_access_modules.sql` después de 009. La edición de miembros activos
usa `admin_tenant_update_access`: mantiene la membresía activa y conserva también
los módulos seleccionados para administradores. No reinicia una invitación ni
reemplaza tablas de otros módulos. El snapshot sigue consultando la tabla real
`admin_tenant_member_modules` por institución y perfil; no usa tablas supuestas
como `user_tenant_modules`.

Actualizar la Edge Function existente `admin-tenant-invite` con el paquete
regenerado para habilitar `notify_access`. Tanto la edición como la aprobación
invocan esa acción después de guardar; una nueva invitación conserva su envío
original. El servidor verifica actor, cuenta, estado activo e institución antes
de enviar un enlace Auth. Las cuentas confirmadas reciben un magic link; las no
confirmadas reciben un enlace de invitación. No se revocan membresías ni módulos
cuando falla el correo. La tabla permite «Reenviar correo de acceso».

La plantilla `access-notification-email.html` puede copiarse en las plantillas
Magic Link e Invite de Supabase Auth para explicar el cambio de rol y los módulos.
El nombre concreto del rol se consulta tras autenticar; no se usan metadatos de
Auth como fuente de autorización. La plantilla remota no cambia al publicar el
frontend. Un resultado de envío satisfactorio confirma la aceptación del proveedor,
no la recepción en la bandeja del destinatario. Se mantienen los límites de correo.

### Registros autónomos y aprobación

El endpoint de `/register` crea una membresía base inactiva, no necesariamente una
fila en `admin_membership_requests`. La consulta `admin_tenant_snapshot_v3` reúne
ambas fuentes dentro de la institución activa y excluye invitaciones por correo.
El formulario de aprobación permite completar el celular que `/register` no recoge.
Los roles internos y los invitados aprobados se muestran en la lista de miembros.

Para habilitar este contrato, ejecutar `008_guest_role_label.sql` y confirmar su
transacción; luego ejecutar `009_registration_requests.sql` después del script 007.
Los scripts se han preparado localmente: no se aplican automáticamente a Supabase.
Sin el contrato v3, se conserva la lectura anterior y no se pueden reunir todas las
solicitudes autónomas. La aprobación usa `admin_tenant_approve_registration`, no una
Edge Function de invitación. No requiere desplegar nuevamente una Edge Function.

La operación bloquea la institución, verifica al revisor, activa el rol seleccionado,
conserva los módulos habilitados y registra la revisión de forma atómica. Rechaza
cuentas propias/protegidas, solicitudes ya revisadas, invitaciones pendientes y
registros de otra institución. `guest` es un rol base aprobado sin permisos de gestión;
las membresías inactivas de `viewer`, `invitado` o `pending` siguen sin conceder acceso.
La aprobación no modifica credenciales ni confirma el correo de Auth: esa verificación
continúa siendo responsabilidad del flujo de identidad correspondiente.

### Cobertura de roles y módulos

El flujo común de invitación, datos personales bloqueados, contraseña y aceptación
se verifica para `institution_admin`, `teacher`, `secretary`, `staff`, `dece`,
`projects_manager`, `content_editor` y `student` en cuatro instituciones aisladas.
El Super Admin invita administradores; el Administrador Institucional invita los
roles internos. Se conservan las protecciones de cuentas propias y de mayor jerarquía.

`target_modules` se valida y guarda en `admin_tenant_member_modules` al preparar la
invitación. Esos permisos no conceden acceso mientras la membresía esté inactiva.
La aceptación activa la membresía sin sustituir ni ampliar la selección de módulos.
La vista de entrada de roles internos muestra solo los permisos verificados por
TenantContext. Las rutas y autorizaciones internas de otros módulos no se modifican.

El Super Admin continúa teniendo alta inicial administrativa y titularidad única;
no se habilita su invitación ni transferencia mediante el formulario común.
La matriz SQL comprueba también que un Admin no pueda invitar o sustituir al Super
Admin. Cambiar esa política requiere definir un flujo de transferencia de titularidad.

### Solicitud desde un enlace expirado

Actualizar `admin-tenant-invite` con el paquete regenerado para habilitar la acción
`request_invitation_email`. La acción permite solicitudes sin sesión de usuario;
el gateway debe permitir la invocación con la clave pública de la aplicación.
Conservar la validación de identidad de las demás acciones administrativas.
Configurar `ADMIN_ALLOWED_ORIGINS` con los orígenes de localhost y producción.

El solicitante introduce su correo y la institución procede del enlace. El
servidor busca una invitación no aceptada, obtiene el destinatario desde los datos
almacenados y construye la redirección con el slug institucional canónico. No crea
cuentas, no cambia roles y no activa membresías. La respuesta de aceptación no
revela si existe una invitación y no certifica la recepción en la bandeja de correo.

El formulario muestra una cuenta regresiva y respeta las respuestas 429. El límite
local del servidor es de 60 segundos por correo y por instancia; no es un límite
distribuido persistente. Se mantienen los límites del proveedor de Auth/correo;
el cliente no los elude. La espera máxima del envío es de 15 segundos.

### Reenvío de invitaciones pendientes

La tabla de pendientes ofrece «Reenviar invitación» a los gestores autorizados.
Reutiliza `admin-tenant-invite` con `action: 'invite'`, los datos verificados de la
fila y la institución activa. No requiere una Edge Function adicional ni activa
la membresía. El contrato de usuarios existentes del script 007 debe estar instalado.
Los errores de correo conservan la invitación pendiente y muestran una advertencia
para permitir el reintento manual; no hay reintentos automáticos que consuman cuotas.

El paquete de despliegue incluye un límite de espera de 15 segundos para el envío
de correo. Para aplicar ese límite en Supabase se debe actualizar la función
existente con el paquete regenerado; el botón utiliza el contrato `pending-v1`
ya existente. Un reenvío no evita los límites ni corrige la configuración SMTP.

### Contraseña de aceptación y cuentas con MFA

Cuando Auth rechaza el cambio de contraseña por AAL2, el cliente utiliza la acción
`complete_invitation_password` de `admin-tenant-invite`. Actualizar la función
existente con `admin-tenant-invite.deploy.txt` es necesario para habilitarla;
editar el frontend no actualiza la función desplegada. Regenerar el paquete con
`node src/modules/admin/backend/buildAdminEdgeBundle.mjs`.

La acción verifica el JWT con Auth, exige confirmación OTP/invitación/recuperación
de los últimos 10 minutos y una invitación pendiente propia en la institución.
El identificador del usuario procede de Auth, nunca del cuerpo de la solicitud.
La contraseña se actualiza con la API administrativa solo en el servidor; después
el cliente acepta la membresía con su sesión y conserva el contexto institucional.
No se eliminan factores MFA. La contraseña pertenece a la cuenta Auth completa,
por lo que su cambio afecta a los accesos de esa cuenta en todas las instituciones.
Sin enlace reciente o invitación pendiente, la operación se rechaza.

Este paquete está preparado y probado localmente. No se ha aplicado a Supabase.
La autorización procede de una membresía activa de la institución seleccionada;
los metadatos de Auth y los parámetros de navegación no conceden permisos.

## Contrato y preparación del backend

1. Revisar el esquema y respaldar la base antes de cualquier despliegue autorizado.
2. Ejecutar las sentencias de `001_role_labels.sql` individualmente y confirmar
   sus transacciones antes de ejecutar `002_tenant_admin.sql`.
3. Ejecutar `002_tenant_admin.sql`. Instala RPC con institución obligatoria,
   restricciones de lectura/escritura y permisos individuales de módulos.
   Deshabilita para clientes los RPC administrativos anteriores con alcance global.
4. Ejecutar `003_superadmin_audit.sql`. Identificar con el responsable las cuentas
   reales de los propietarios y provisionar sus membresías mediante una operación
   administrativa revisada. El script no inventa propietarios ni convierte cuentas
   globales automáticamente. El índice lógico impide dos Super Admin activos en
   una institución; el alta inicial requiere una cuenta verificada por institución.
5. Publicar `inviteTenantUser.ts` como función `admin-tenant-invite`, con un
   adaptador del entorno que invoque `handleTenantInvitation`. Mantener la clave
   de servicio únicamente en secretos del servidor. Revisar los nombres del
   contrato `TenantInvitationEnvironment` en ese archivo y configurar los orígenes
   permitidos explícitamente.
6. Retirar o restringir los endpoints administrativos heredados de invitación
   (`invite-institution-user`) y notificación (`notify-approved-member`) antes de
   habilitar el nuevo flujo. Un endpoint privilegiado antiguo puede eludir la
   autorización del cliente. Este cambio local no modifica servicios desplegados.

El Super Admin asigna únicamente administradores de su institución. El Admin
asigna roles internos y módulos habilitados de su plantel. Ninguno puede modificar
su propia membresía ni una membresía de mayor jerarquía. Un usuario puede tener
roles diferentes en instituciones diferentes. Las operaciones fallan de forma
cerrada cuando el backend nuevo todavía no está instalado.

Las políticas y rutas de otros módulos quedan fuera de esta entrega. Su revisión
coordinada es necesaria antes de afirmar aislamiento de toda la plataforma.

## Verificación local

### Invitación pendiente y aceptación por correo

La entrada de Admin y el login público autorizado usan `InvitationLinkBoundary`.
Captura `type=invite/recovery/magiclink`, sesiones implícitas y `token_hash`.
Primero espera la inicialización automática del SDK; no vuelve a verificar un
token ya consumido si la sesión correspondiente existe. Tras verificar, elimina
los parámetros de autenticación de la navegación y conserva institución/slug.
Si la sesión ya existe sin hash, consulta la invitación propia antes de decidir
la navegación. Un enlace `otp_expired` muestra su Toast específico y no monta el
formulario que interpreta errores OAuth. No se pueden renovar tokens vencidos
o utilizados desde el frontend: se necesita enviar otro correo. Estas pruebas
simulan callbacks; no certifican entregabilidad ni validez de enlaces publicados.

El formulario «Asignar acceso» siempre llama a `admin-tenant-invite` con
`action: 'invite'`. No ejecuta primero asignación ni aprobación directa por RPC,
incluso si el correo coincide con una solicitud de acceso. Un contrato antiguo,
un fallo de API o un correo no enviado producen error, sin fallback a activación.
Las cuentas Auth existentes se reutilizan: se consulta el destinatario mediante
una RPC autorizada y se prepara solo la membresía pendiente de ese plantel.
Las cuentas confirmadas reciben un enlace de acceso (`otp`, `create_user:false`);
las no confirmadas reciben otra invitación. Nunca se resetea la contraseña de
una cuenta existente desde la operación administrativa ni se elimina al fallar.

Para activar este contrato, aplicar `006_pending_invitations.sql` después
de `002_tenant_admin.sql` y luego `007_existing_user_invitations.sql`.
Luego regenerar el paquete y actualizar la función
existente `admin-tenant-invite` usando `admin-tenant-invite.deploy.txt`.
No se aplicó el SQL ni se desplegó la función desde este entorno.

La nueva cuenta de Auth queda sin confirmar; las cuentas existentes conservan
su identidad y sus demás accesos. La RPC de preparación asigna su rol,
registra los datos originales y deja `memberships.is_active=false` dentro de una
sola transacción, sin exponer un estado activo intermedio. Un trigger bloquea la
activación mediante el flujo normal de asignación mientras la invitación esté
pendiente. El snapshot v2 separa estas cuentas como «Invitado · Pendiente de
aceptación»; los roles desactivados ordinarios mantienen su estado «Inactivo».

El correo vuelve a `/panel/admin` con solo `institution` (UUID) y `slug` canónico.
El helper compartido de Admin aplica NFD, elimina tildes, normaliza minúsculas y
convierte espacios/puntuación a guiones. No añade datos personales, roles ni
`institution_id` duplicado al callback. La comparación del slug en la función y
la aceptación usa la misma normalización, siempre junto con el UUID verificado.
Los datos personales/rol permanecen en el cuerpo y en los metadatos de Auth.
Los parámetros no autorizan ni modifican el rol. El slug guardado en la base no
se renombra; tras aceptar se restaura su valor exacto si los contextos compartidos
lo necesitan. No se modifica ningún contexto global.
Admin carga los valores bloqueados mediante la RPC de invitación propia, que
exige identidad y correo confirmados y verifica institución y membresía pendiente.
Esta pantalla se renderiza antes de los guardianes del panel, sin conceder acceso
administrativo. Solo contraseña y confirmación son editables y tienen ojo.

Al enviar, Auth actualiza la contraseña y la RPC de aceptación activa la membresía
original de forma atómica, verificando que el emisor siga autorizado. La cuenta se
confirma mediante el enlace de correo, no con una bandera del navegador. Si falla
la activación, la membresía continúa pendiente y el formulario permite reintentar.
La sesión se renueva después de aceptar para que los contextos existentes lean el
rol activo. No se modifican los contextos compartidos ni se crean cuentas duplicadas.

La invitación y la aceptación tienen Toasts independientes de éxito/error. Un fallo
de correo no activa ni elimina la membresía pendiente. Reinvitar una membresía
gestionable la devuelve a pendiente solo en el plantel seleccionado; no recrea
la cuenta ni modifica sus membresías en otros planteles. Las invitaciones antiguas sin registro pendiente pueden completar la
contraseña usando su perfil/membresía activa original.

Configurar los orígenes en `ADMIN_ALLOWED_ORIGINS`, autorizar los callbacks de Auth
y mantener el correo/SMTP operativo. El DELETE directo de miembros no cambia.

El flujo vigente de «Eliminar miembro» usa DELETE directo de `memberships` con
los filtros `institution_id` y `profile_id`, y solicita la fila eliminada con
`select`. No llama a Edge Functions ni a una RPC de borrado. Solo después de
recibir exactamente esa fila, la retira del estado React y muestra:
«Miembro eliminado correctamente de la Unidad Educativa.»

### Activar el DELETE directo una sola vez

El frontend no puede concederse privilegios ni evitar RLS. Si Supabase rechaza
el DELETE, ejecutar `005_membership_delete_permissions.sql` en su SQL Editor
con el rol de migraciones, después de tener instalado `002_tenant_admin.sql`.
Este cambio está preparado localmente: no se ha aplicado al servidor.

El script agrega permisos DELETE y políticas específicas de eliminación para
usuarios autenticados con una membresía administrativa activa en ese plantel.
La política restrictiva protege también frente a políticas permisivas heredadas.
Bloquea autoborrado, eliminación del Super Admin y eliminación entre instituciones.
Admin y Super Admin pueden eliminar otros administradores o miembros de su plantel.
Un trigger limpia los permisos individuales del miembro en la misma transacción.
El perfil, la cuenta de Auth y las demás membresías se conservan. No desactiva RLS.

No hace falta desplegar o actualizar Edge Functions para este flujo. Los handlers
y el paquete de Edge incluidos en esta carpeta son alternativas locales anteriores;
no intervienen en la eliminación vigente. No se incorpora ninguna clave de servicio
al navegador. «Desactivar rol» mantiene su operación separada y conserva la fila.

La suspensión temporal del desafío MFA de Admin se compone en
`auth/AdminSessionPolicy.tsx`. Si el contexto existente exige MFA, se renueva la
sesión real usando su contrato de sesión de contraseña (`auth-login-method`).
Después se vuelven a verificar identidad y membresías con el contexto existente.
No se eliminan factores registrados ni se elevan tokens a AAL2; las restricciones
MFA del servidor siguen vigentes. Esta preferencia pertenece a la sesión del
origen y puede ser observada por otros consumidores de AuthContext aunque no se
modifique su código. Para restaurar el desafío, retirar este adaptador y limpiar
la preferencia de sesión. El login público y su diseño fuera de Admin no se
modifican en esta entrega.

El panel administrativo incluye un selector de Unidad Educativa para cuentas con
membresías activas de Super Admin. Solo lista los planteles asignados a la sesión.
Cambiar la selección actualiza el contexto local y navega a `/panel/admin` con
`institution` y `slug`; no cierra la sesión. El panel vuelve a verificar permisos
y cargar usuarios para ese plantel, ocultando los datos de la selección anterior.
La preferencia se conserva mediante el respaldo de sesión existente.

Ante un UUID y un slug conflictivos, Admin consulta las membresías activas de la
cuenta: tiene prioridad el ID asignado y se reemplazan ambos parámetros en una
sola navegación. Si el ID no existe entre esas membresías, se intenta el slug
asignado. No se normaliza hacia instituciones ajenas. El título del documento,
el encabezado y el pie propios de Admin utilizan el mismo nombre verificado.
Los componentes globales y el login fuera de Admin no se modifican.

Las nuevas invitaciones incluyen `redirect_to` con `/login?institution=…&slug=…`.
La función verifica origen, ruta y correspondencia con la institución antes de
crear la cuenta. Tras asignar la membresía, envía una invitación de Supabase Auth
mediante `/auth/v1/invite`, en lugar de una recuperación al origen del sitio.
Al acceder al panel con esa cuenta, Admin solicita definir la contraseña antes
de continuar. Si el correo falla, se informa sin eliminar la membresía aprobada.
Es necesario desplegar esta versión de `admin-tenant-invite`, configurar SMTP y
autorizar los callbacks institucionales en Supabase Auth. Las pruebas locales no
envían correos reales ni comprueban la configuración del servicio desplegado.

Referencia: [invitaciones de Supabase Auth](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).

Las pruebas `tenantIsolation.database.test.mjs` aplican los scripts a PostgreSQL
embebido, sin conexión a Supabase. Usan PGlite instalado localmente o la ruta
indicada por `PGLITE_TEST_MODULE`. Las pruebas de invitación simulan HTTP; no crean
cuentas reales ni envían correos.

```powershell
node --experimental-strip-types --test src/modules/admin/auth/*.test.mjs src/modules/admin/userManagement/tenantAdminService.test.mjs src/modules/admin/userManagement/membershipVisibility.test.mjs src/modules/admin/backend/*.test.mjs
npm.cmd run build
```
