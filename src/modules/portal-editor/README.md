# Editor del portal institucional

Editor de identidad, logo, tema, menús, páginas y secciones. La entrada es `/panel/portal`; la publicación se consulta en `/?institution=<slug>&slug=<pagina>`, dentro del portal del equipo. Los enlaces antiguos de `/portal` redirigen a esa ruta.

El acceso usa el login y los proveedores compartidos de autenticación e institución. No tiene un segundo login ni un desafío MFA propio. Editores guardan borradores; administradores pueden publicar. Los borradores son privados y la publicación usa una operación transaccional con control de revisión.

El logo y las imágenes admiten PNG/JPG/WebP de hasta 5 MB y 6000 × 6000 píxeles, o URL HTTPS. Los archivos cargados en `portal-assets` son públicos desde su carga: usar solo imágenes autorizadas. Retirar una imagen de un borrador no elimina el archivo ni rompe versiones publicadas. Los comprobantes usan el bucket privado independiente `project-receipts`.

La plantilla, tipografía, colores y menú son configuración institucional. La vista previa usa `SiteFrame` y `PageSections`, los mismos componentes del portal, con interacción desactivada. Noticias, personal, eventos y reconocimientos se leen de fuentes públicas de la institución. Las imágenes individuales de galería y las plantillas se interpretan igual en la vista previa y la página publicada.

Los estilos están aislados en `portal.module.css`. Las propuestas de SQL pendientes se documentan en `supabase/proposals/projects/README.md`. La prueba local no sustituye revisar el backend de integración y completar el recorrido de guardar, cargar imágenes y publicar antes de producción.

Al publicar, el editor notifica a las pestañas del portal de la misma institución. La página pública vuelve a consultar el contenido al recuperar el foco y cada 30 segundos mientras está visible, incluyendo visitantes en otros dispositivos. Las consultas de fondo conservan el contenido mientras cargan y descartan respuestas de una institución anterior. No se transmite contenido de borradores entre pestañas; guardar un borrador no publica cambios. La página pública aplica la misma plantilla que la vista previa.

El encabezado usa una navegaci?n fija compartida por las cuatro instituciones. El editor no cambia sus enlaces, orden ni estilo. El nombre y el logotipo siguen siendo propios de cada instituci?n. Los borradores antiguos no pueden reemplazar esa navegaci?n al publicarse.
