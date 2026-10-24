# Acceso administrativo en Render

La aplicación usa React Router y el mismo cliente de Supabase en ambos orígenes.
La selección de institución es una preferencia de navegación, nunca una autorización.
El acceso se verifica con el usuario autenticado, los roles y las membresías activas.

## Hallazgo en el sitio publicado

Comprobación pública del 23 de octubre de 2026 en
`https://proyectovinculaci-n.onrender.com`:

| Ruta | HTTP |
| --- | --- |
| `/` | 200 |
| `/index.html` | 200 |
| `/login` | 404 |
| `/panel/admin` | 404 |
| `/panel/instituciones` | 404 |

Las rutas profundas no sirven el documento de la aplicación. El error ocurre antes
de que React pueda leer la sesión o consultar los roles. Cambiar el guardián de
autenticación no configura el servidor de Render.

## Configuración del Static Site

En el servicio existente, abrir **Redirects/Rewrites** y añadir al final de las
reglas existentes:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

Usar Rewrite para conservar la ruta y sus query params, incluidos `institution`
y `slug`. Una redirección a `/` perdería la ruta solicitada. Render conserva los
recursos que existen, como los archivos de `/assets/`.

Si el sitio se administra con un Blueprint existente, la regla equivalente dentro
del servicio de tipo `static` es:

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

Este documento no crea otro servicio ni modifica la configuración de los módulos.
La regla debe aplicarse al servicio ya publicado. Para un Web Service, configurar
el fallback de la SPA en su servidor en lugar de usar ajustes de Static Sites.

Usar `npm ci && npm run build` para compilar y `dist` como directorio publicado.
Las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben apuntar
al mismo backend esperado y estar disponibles durante la compilación.

## Redirecciones de Supabase Auth

Verificar en Supabase Auth que estén autorizados los callbacks utilizados:

- `http://localhost:5173/panel/admin` y el origen local para recuperación.
- `https://proyectovinculaci-n.onrender.com/panel/admin` y el origen de producción
  para recuperación.

El código construye los callbacks con `window.location.origin`; no fuerza localhost
ni traslada tokens entre dominios. Cada origen mantiene su propia sesión.

## Validación posterior

1. Abrir directamente `/login` y `/panel/admin`, también con ambos query params.
2. Comprobar respuesta 200 y recargar las rutas sin perder la institución.
3. Entrar con Super Admin: destino `/panel/admin`, sin solicitud de acceso.
4. Entrar con una membresía aprobada: destino correspondiente a ese rol.
5. Cambiar de institución y verificar el rol asignado en cada una.
6. Confirmar que los errores de red no muestran el formulario para solicitar acceso.

Referencias: [reescrituras de Render](https://render.com/docs/redirects-rewrites),
[URLs de redirección de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
