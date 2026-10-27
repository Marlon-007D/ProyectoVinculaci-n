# Solicitudes pendientes de membresía

> Contrato vigente: [administración por institución](../backend/README.md).
> El panel usa exclusivamente los RPC `admin_tenant_*`. Super Admin es un rol
> de membresía de una institución, sin autorización global. El material siguiente
> describe el seed y las pruebas de la migración anterior; no basta para activar
> el panel actual. No ejecutar seeds contra producción como parte de este cambio.

Esta entrega conserva el registro y las notificaciones institucionales existentes. Las nuevas solicitudes de `admin_membership_requests` y el seed se integran con las tres pestañas. La ruta `/login` de `develop` incorpora Google OAuth y el formulario de solicitud mediante el contrato tipado de este módulo.

Guía directa: [Google OAuth y aprobación en El Esfuerzo y las otras unidades](./GOOGLE_OAUTH_TEST.md).

## Seed de una solicitud de prueba

Ejecutar desde la raíz activa, después de instalar la migración 0009:

```powershell
node --experimental-strip-types src/modules/admin/userManagement/seedPendingRequest.ts
```

El proceso necesita `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` (o la URL
`VITE_SUPABASE_URL` existente) en el entorno privado o en `.env.local`.
Nunca usar el prefijo `VITE_` para la clave administrativa ni incluirla en Git,
en componentes o en capturas. El script no forma parte del bundle web.

Crea mediante la API administrativa una cuenta confirmada `invitado.prueba@test.com`,
sin enviar correos y con una contraseña aleatoria que no se imprime. Después
inserta «Usuario Prueba», celular de demostración `0991234567`, estado `pending`,
para El Esfuerzo. El correo se obtiene desde Auth al listar solicitudes; no existe
una columna de correo duplicada en `admin_membership_requests`.

El seed conserva una solicitud pendiente existente, rechaza solicitudes ya
aprobadas y no modifica cuentas con membresías previas. Si falla después de
crear la cuenta, puede repetirse: no elimina cuentas ni registros existentes.
Este registro sirve para probar la aprobación en el panel, no para probar Google.

Con una sesión de Administrador institucional de El Esfuerzo, abrir
[el panel con contexto](http://localhost:5173/panel/admin?institution=f96873d4-9deb-4b8d-9677-348861cbd277&slug=ue-el-esfuerzo),
refrescar y seleccionar «Usuarios Registrados». Debe aparecer el correo de prueba
con «Pendiente de aprobación» y la acción «Aprobar y asignar rol».

El seed no se ejecutó contra Supabase desde este entorno porque solo están
configuradas las credenciales públicas, sin la clave administrativa.

El estado pendiente pertenece a `admin_membership_requests`, separado de
`memberships.is_active`. Una cuenta desactivada no se convierte en una solicitud.
Las solicitudes no crean perfiles administrativos ni otorgan acceso a módulos.

La persona confirma su cuenta, inicia sesión en `/login?institution=<id>&slug=<slug>`
y completa «Solicitud de acceso» con nombres, apellidos y celular. La institución
se valida en el servidor y el solicitante se obtiene de `auth.uid()`, nunca de
un identificador enviado por el formulario. Esto también funciona al volver de
Google cuando la cuenta no tiene membresía.

El administrador encuentra la solicitud en «Usuarios Registrados». Al seleccionar
«Aprobar y asignar rol», la RPC asigna el rol y cambia la solicitud de `pending`
a `approved` en una sola transacción. Si falla cualquier paso, sigue pendiente.
Las siguientes consultas actualizan el contador y muestran la cuenta en la
pestaña correspondiente a su rol. No se requieren cambios en otros módulos.

Solo el Super Admin de la institución puede asignar su administrador institucional.
El administrador asigna roles internos. Las aprobaciones propias, de mayor
jerarquía y de otra institución se rechazan en el nuevo contrato del servidor.

## Activación de la base de datos

La migración es `drizzle/0009_admin_membership_requests.sql`. Está registrada
en el historial de Drizzle. Para activar únicamente este cambio en Supabase,
ejecutar ese archivo en SQL Editor con el rol de migraciones dentro de una
transacción (`BEGIN;`, contenido del archivo, `COMMIT;`). No es necesario ejecutar
las migraciones de otros módulos. La migración crea una tabla con RLS y sus RPC;
no modifica las tablas ni las funciones de los compañeros.

Se requiere que el backend existente tenga `auth.users`, `institutions`, `roles`,
`memberships` y la RPC `assign_institution_role` de seis parámetros. No se aplicó
la migración al servidor desde este entorno porque no hay `DATABASE_URL`.
Mientras falte la migración, los usuarios existentes siguen listándose y se muestra
un error explícito para las solicitudes pendientes; no se inventan solicitudes.

## Pruebas sin conexión al servidor

Se ejecutaron los escenarios SQL sobre PostgreSQL embebido (PGlite), con cuentas
y esquemas exclusivos de prueba. Para repetirlos sin cambiar las dependencias
del proyecto:

```powershell
npm.cmd install --prefix tmp/pending-db-test --no-save --package-lock=false @electric-sql/pglite
$env:PGLITE_TEST_MODULE = (Resolve-Path 'tmp/pending-db-test/node_modules/@electric-sql/pglite/dist/index.js').Path
node --test src/modules/admin/userManagement/membershipRequests.database.test.mjs
node --experimental-strip-types --test src/modules/admin/userManagement/membershipVisibility.test.mjs
```

Las pruebas cubren aislamiento por institución, RLS, cuentas no confirmadas,
ausencia de permisos antes de aprobar, rechazo de roles globales, aprobación
atómica, solicitudes duplicadas y errores de asignación. El recorrido completo
en el servidor necesita aplicar primero la migración y utilizar cuentas de prueba.
