# Tema institucional

Esta capa es responsabilidad general de la aplicación. Convierte una configuración de tema en variables CSS; no conoce páginas DECE y no depende de Supabase.

## Flujo actual

1. `default-theme.ts` contiene los valores de respaldo usados al iniciar.
2. `theme.types.ts` define los campos que la interfaz puede consumir. Sus nombres corresponden a los campos visuales de `public.themes`, sin representar una consulta SQL.
3. `theme.service.ts` aplica primero los valores de respaldo y luego, si recibe una función lectora, aplica los valores válidos devueltos por ella. Si no hay lectora, no hay fila o la lectura falla, permanece el tema de respaldo.
4. `main.tsx` espera la inicialización antes de montar React para evitar mostrar brevemente una paleta diferente.

Todavía no se conecta una fuente de datos: actualmente se llama `initializeTheme()` sin lector. Para integrar Supabase en el futuro, la capa de infraestructura debe implementar una función que seleccione el tema de la institución y devolver sus campos visuales; esa función se pasará a `initializeTheme(readTheme)`. La selección de institución y de tema activo debe definirse en esa integración, no en DECE.

`appearance_config` se conserva en el tipo, pero no se interpreta porque aún no existe un contrato para sus propiedades. El servicio valida colores y valores numéricos positivos. El campo `updated_at` y los identificadores de base de datos no pertenecen al contrato visual.

## Variables consumidas

El CSS global define los valores de respaldo y mapea las variables de Bootstrap a variables semánticas. Los componentes deben consumir `--color-*` y los tokens tipográficos; no deben leer registros ni decidir de dónde provienen.
