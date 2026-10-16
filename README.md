# Plataforma Web Institucional

Plataforma multiinstitucional para gestión de proyectos de vinculación, atención DECE, portal educativo, simuladores académicos y administración de usuarios y roles.

## Desarrollo local

1. Instala dependencias con `npm ci`.
2. Copia `.env.example` a `.env` y configura las credenciales públicas de Supabase.
3. Inicia la aplicación con `npm run dev`.

## Compilación y publicación

- `npm run build` compila TypeScript y genera la aplicación en `dist`.
- `npm run preview` sirve localmente la compilación.
- El workflow de GitHub Actions publica `dist` en GitHub Pages y ajusta la ruta base al nombre del repositorio.

Los cambios que todavía se guardan en `localStorage` permanecen en el navegador del usuario y no se sincronizan entre dispositivos.
