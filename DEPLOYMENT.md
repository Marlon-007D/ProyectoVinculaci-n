# Despliegue manual en Vercel

El proyecto usa React con Vite. Compila con `npm run build` y genera el sitio en `dist`. `vercel.json` ya define estos ajustes y las rutas de la aplicación.

## Primera configuración en otro equipo

```powershell
npm install -g vercel
vercel login
vercel link --project simuladores-educativos-brigitte
```

Completa `vercel login` en el navegador. `vercel link` asocia esta carpeta local con el proyecto existente de Vercel.

## Publicaciones siguientes

Desde la carpeta del proyecto:

```powershell
npm run deploy
```

Este comando compila la aplicación y luego la publica en producción con Vercel. Requiere haber instalado y configurado la CLI con los pasos anteriores.

No hace falta conectar GitHub ni ejecutar GitHub Actions. El archivo `.env` y las credenciales locales no se publican. Supabase no es necesario para desplegar; si más adelante se activa, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno del proyecto en Vercel.
