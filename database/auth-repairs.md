Correcciones de registro, revocación y notificaciones
===================================================

Aplicar `repair_remove_institution_role.sql` en el SQL Editor del proyecto Supabase correspondiente, después de las migraciones institucionales existentes. La RPC usa el perfil de Auth (`profile_id = auth.uid()` para el actor) y recibe `target_profile_id` junto con `target_institution_id` para el destinatario. Conserva RLS, comprueba el administrador del plantel y desactiva únicamente la membresía indicada. El superadministrador solo puede retirar administradores institucionales; un administrador institucional no puede retirar administradores.

La reparación requiere un propietario `postgres` para la función `SECURITY DEFINER`. No concede UPDATE ni DELETE de membresías al cliente. Prefiere `invitado` para el estado pendiente y admite los nombres heredados cuando ese rol no existe.

Publicar las funciones actualizadas:

```powershell
npx.cmd supabase functions deploy notify-approved-member
npx.cmd supabase functions deploy invite-institution-user
```

Configurar los secretos del entorno de pruebas mediante Supabase Dashboard → Edge Functions → Secrets:

- `RESEND_API_KEY`: clave válida de Resend, almacenada solo en el servidor.
- `APPROVAL_EMAIL_FROM`: remitente permitido por Resend; para pruebas puede ser `onboarding@resend.dev`.
- `APP_SITE_URL`: `http://localhost:5173` para esta prueba local.
- `APPROVAL_EMAIL_TEST_MODE`: `true` para habilitar el reenvío de prueba.

Con ambos ajustes locales, un rechazo 403 de Resend por destinatario de pruebas provoca un único reintento hacia `dmsosa2@espe.edu.ec`. Otros errores no se redirigen. El mensaje conserva el enlace de la cuenta aprobada; utilizar únicamente cuentas de prueba. La interfaz informa del envío de prueba y la notificación real permanece pendiente. No se imprimen claves ni enlaces de acceso en logs.

En producción configurar la URL pública y desactivar `APPROVAL_EMAIL_TEST_MODE`. El modo de prueba se configura en la función, no a partir del encabezado Origin del navegador.

Verificación local: `npm.cmd run test:security` y `npm.cmd run build`. La compilación de Vite verifica el frontend; las pruebas ejercitan el transporte de correo con respuestas simuladas. La validación de RLS requiere aplicar la reparación y probar con sesiones reales de administrador y de un usuario de otro plantel. No se enviaron correos reales durante las pruebas automatizadas.
