# Producción: Vercel o Netlify

## Variables y compilación

Configura en el hosting, antes de compilar:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=CLAVE_PUBLICA_ANON_O_SB_PUBLISHABLE
```

Usa `.env.example` como plantilla local. Vite carga `.env.production.local`,
`.env.production`, `.env.local` y `.env`; las variables del proceso tienen prioridad.
Las variables `VITE_*` se incorporan al JavaScript público durante el build.
Nunca pongas claves `service_role`, `sb_secret_`, contraseñas SQL ni secretos Google
en estas variables. Cambiar valores en el hosting exige un nuevo despliegue.
`npm run build` valida URL HTTPS y tipo de clave antes de ejecutar TypeScript y Vite.

## Configurar Supabase Auth

En **Authentication > URL Configuration**, reemplaza el dominio de ejemplo por
el dominio público definitivo, sin barra final en Site URL:

```text
Site URL:
https://tu-proyecto.vercel.app

Redirect URLs:
https://tu-proyecto.vercel.app/panel/admin**
https://tu-proyecto.vercel.app/login**
https://tu-proyecto.vercel.app
```

Para Netlify usa `https://tu-proyecto.netlify.app` en las mismas entradas.
La entrada del origen permite el retorno de recuperación de contraseña existente.
Los patrones del panel conservan `institution` y `slug` al regresar de OAuth.
Limita las entradas al dominio controlado de producción; configura staging por separado.

En **Authentication > Sign In / Providers > Google**, habilita Google y guarda
el Client ID y Client Secret de Google Cloud. En Google Cloud, en el cliente OAuth web,
añade como **Authorized redirect URI** el callback mostrado por Supabase:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

El callback de Google y las URLs de retorno de la aplicación son configuraciones diferentes.
En Google configura el dominio/consentimiento y los usuarios permitidos según el estado
de publicación del cliente. El secreto Google permanece en Supabase.

## Migraciones, RLS y funciones

El hosting solo publica el frontend: el build no aplica migraciones ni despliega funciones.
Para comprobar el backend sin escribir datos:

```powershell
npm.cmd run db:verify-production
```

El script consulta los ajustes públicos de Auth y prueba con HEAD que la tabla de
solicitudes deniega acceso anónimo. Con `DATABASE_URL` en el entorno privado también
consulta RLS, políticas y hashes del historial Drizzle en una transacción de solo lectura.
Al ejecutar el script con Node, salida 2 indica verificaciones pendientes y salida 1
indica fallo de conexión/consulta; npm puede reportar ambos como salida 1.
Una tabla accesible o una bandera RLS no demuestran aislamiento completo: valida con
cuentas de dos instituciones y roles diferentes. La API pública no permite certificar
Site URL, Redirect URLs, secretos ni todo el backend.

Antes de migrar, verifica el proyecto destino, su respaldo recuperable y las dependencias
del esquema institucional existente (`institutions`, `profiles`, `memberships`, `roles`
y funciones de autorización). El manifiesto `db:backup-public` solo describe el esquema;
no es un respaldo de datos. Para una base compatible y revisada:

```powershell
# DATABASE_URL debe existir solo en el entorno privado de esta terminal/CI.
npm.cmd run db:migrate
npm.cmd run db:verify-production
```

Drizzle usa `drizzle/meta/_journal.json`: `0009_admin_membership_requests` está
registrada después de `0013`; no ordenar los archivos por nombre ni ejecutarlos dos veces.
Los archivos de `supabase/legacy-migrations` y `supabase/proposals` no se aplican
automáticamente; no ejecutar todo ese contenido sobre producción.

Comprueba también que estén desplegadas las Edge Functions institucionales
`register-institution-user`, `invite-institution-user` y `notify-approved-member`.
Para notificaciones configura en Supabase los secretos `RESEND_API_KEY`,
`APPROVAL_EMAIL_FROM` y `APP_SITE_URL` con el dominio final; desactiva
`APPROVAL_EMAIL_TEST_MODE` en producción. Revisa la política JWT de cada función
antes de desplegarla, conservando el registro público y la autorización de administradores.
En `supabase/config.toml`, el registro ya usa `verify_jwt = false` y la notificación
usa `verify_jwt = true`; conserva estos ajustes del flujo existente.

## Publicar

Vercel: importa el repositorio, selecciona la rama deseada (por ejemplo `develop`),
framework Vite, build `npm run build` y salida `dist`. Carga las variables para
Production antes de desplegar. `vercel.json` ya reescribe rutas a `/index.html`.
Alternativa CLI desde la raíz:

```powershell
npx vercel login
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```

Para enlazar el proyecto Vercel existente explícitamente, usa
`npx vercel link --project simuladores-educativos-brigitte`.
El script existente `npm run deploy` también compila y ejecuta `vercel --prod`
si la CLI ya está instalada y enlazada.

Netlify: importa el repositorio y carga las variables para el contexto Production.
`netlify.toml` configura build y salida; Vite copia `public/_redirects` a `dist`.
Alternativa CLI (las variables públicas deben estar disponibles en el build local):

```powershell
npx netlify-cli login
npx netlify-cli link
npm.cmd run build
npx netlify-cli deploy --prod --dir=dist
```

Con integración Git ya conectada y configurada, un `git push origin develop`
dispara el despliegue de producción solo si esa es la rama elegida por el hosting.
En otros shells puede usarse `npm` en lugar de `npm.cmd`.

## Comprobación después de publicar

Abre directamente y recarga `/login?institution=ID&slug=SLUG` y `/panel/admin`.
Verifica que los assets respondan, el contexto se conserve en OAuth y una cuenta
sin membresía vea Solicitud de acceso sin obtener acceso al panel. Comprueba
aprobación por el administrador correcto, aislamiento entre instituciones,
recuperación por correo y MFA cuando corresponda.

## Resultado de la revisión del 23 de octubre de 2026

- Build de producción completado sin errores TypeScript; avisos de PostCSS,
  tamaño de paquetes e importación dinámica de DECE.
- Auth del proyecto configurado responde y declara Google habilitado.
- HEAD anónimo sobre solicitudes responde HTTP 401; esto no acredita por sí solo
  la existencia de todas las políticas ni el aislamiento entre usuarios autenticados.
- No hay `DATABASE_URL` ni token de administración disponibles en el entorno revisado:
  pendientes historial de migraciones, políticas instaladas, Site URL y Redirect URLs.
- No se aplicaron migraciones, modificaron ajustes remotos ni publicó un sitio.

Referencias oficiales:
- https://vercel.com/docs/frameworks/frontend/vite
- https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
