# Simuladores educativos

## Publicar en GitHub Pages

El sitio se compila como una aplicación estática de Vite y no requiere una base de datos para publicarse. Los datos que la aplicación guarda en `localStorage` quedan en el navegador de cada usuario y no se sincronizan entre dispositivos.

1. Sube estos cambios a la rama `feature/simuladores`.
2. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
3. Cada push a `feature/simuladores` ejecutará `.github/workflows/deploy-pages.yml`. También puedes iniciarlo manualmente desde **Actions → Deploy to GitHub Pages → Run workflow** y elegir esa rama.

El workflow instala dependencias con `npm ci`, compila con `npm run build` y publica `dist`. La ruta base se ajusta al nombre del repositorio automáticamente para que funcionen los recursos en GitHub Pages.
