# Editor del portal institucional

Editor de identidad, logo, tema, menús, páginas y secciones. Comparte el contrato de snapshots con el renderizador público existente; no sustituye sus archivos ni sus rutas. La entrada del editor es `/panel/portal` y la publicación se consulta en `/portal?institution=<slug>&page=<slug>`.

El acceso utiliza el adaptador del módulo de proyectos, con identidad verificada por Supabase, permisos del servidor y verificación MFA. Editores guardan borradores; administradores pueden publicar. Los borradores son privados y la publicación usa una operación transaccional con control de revisión.

El logo y las imágenes admiten PNG/JPG/WebP de hasta 5 MB y 6000 × 6000 píxeles, o URL HTTPS. Los archivos cargados en `portal-assets` son públicos desde su carga: usar solo imágenes autorizadas. Retirar una imagen de un borrador no elimina el archivo ni rompe versiones publicadas. Los comprobantes usan el bucket privado independiente `project-receipts`.

La plantilla, tipografía, colores y menú son configuración institucional. La vista previa muestra el borrador; sus enlaces están desactivados. Noticias, personal, eventos y reconocimientos se leen de fuentes públicas de la institución; este editor no administra los módulos de otros participantes.

Los estilos están aislados en `portal.module.css`. Las propuestas de SQL pendientes se documentan en `supabase/proposals/projects/README.md`. La prueba local no sustituye revisar el backend de integración y completar el recorrido de guardar, cargar imágenes y publicar antes de producción.
