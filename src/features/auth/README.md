# Acceso con Google

La ruta `/login` utiliza la vista institucional de dos columnas y Google OAuth.
`/register` conserva el registro institucional y su aprobación existentes.
Los accesos a `/panel/admin` sin sesión
abren `/login`. Los enlaces `/:slug/login` conservan el slug y los parámetros
de la institución.

## Configuración en Supabase y Google

1. Habilitar Google en Authentication > Sign In / Providers de Supabase con el
   client ID y el client secret del proyecto de Google Cloud. El secreto se
   configura en Supabase, nunca en las variables Vite.
2. Configurar en Google Cloud la URL de callback que muestra Supabase:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Autorizar en Authentication > URL Configuration el retorno
   `https://<dominio>/panel/admin` y sus parámetros de contexto. Para permitir
   parámetros variables, usar una regla limitada al panel, por ejemplo
   `https://<dominio>/panel/admin**`. Agregar también el origen y puerto del
   entorno local cuando corresponda.

Referencia: [guía oficial de Supabase para Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
y [configuración de redirecciones](https://supabase.com/docs/guides/auth/redirect-urls).

## Contexto y permisos

La aplicación devuelve a `/panel/admin?institution=<id>&slug=<slug>` si estos
parámetros estaban presentes. Ambos son pistas de selección, no permisos.
El backend debe proporcionar una membresía activa para la cuenta autenticada.
Una cuenta nueva de Google no recibe automáticamente una membresía ni un rol
administrativo. La asignación sigue el procedimiento institucional existente.
Los administradores globales conservan su acceso autorizado.

Mientras se resuelve la sesión OAuth, `/panel/admin` muestra el estado de
validación. Si falta una membresía o un rol, regresa a `/login` manteniendo la
institución y muestra la indicación de solicitar asignación al administrador.
El formulario permanece disponible sin volver automáticamente al panel; permite
cerrar la sesión y usar otra cuenta. Los fallos de consulta se muestran como
errores de verificación, sin atribuirlos a una membresía ausente.

Los estilos de autenticación están en CSS Modules. `auth-utilities.css` no
importa subrutas de Tailwind ni aplica resets globales.

El método Google elimina la marca del acceso por contraseña de una sesión
anterior, para conservar las verificaciones MFA existentes.

## Verificación manual del proveedor

- Probar ambos botones, cancelar el consentimiento y reintentar.
- Completar el acceso con una cuenta asignada a más de una institución y
  comprobar que se abre la indicada por el contexto.
- Probar una cuenta sin membresía y una institución ajena: no deben conceder
  acceso institucional.
- Comprobar el retorno con una cuenta que requiere MFA.

Estas comprobaciones necesitan un proveedor configurado y una cuenta Google;
la compilación y las pruebas locales no sustituyen ese recorrido externo.
