# Editor del portal institucional

Editor de identidad, logo, tema, menús, páginas y secciones. La entrada es `/panel/portal`; la publicación se consulta en `/?institution=<slug>&slug=<pagina>`, dentro del portal del equipo. Los enlaces antiguos de `/portal` redirigen a esa ruta.

El acceso usa el login y los proveedores compartidos de autenticación e institución. No tiene un segundo login ni un desafío MFA propio. Editores guardan borradores; administradores pueden publicar. Los borradores son privados y la publicación usa una operación transaccional con control de revisión.

El logo y las imágenes admiten PNG/JPG/WebP de hasta 5 MB y 6000 × 6000 píxeles, o URL HTTPS. Los archivos cargados en `portal-assets` son públicos desde su carga: usar solo imágenes autorizadas. Retirar una imagen de un borrador no elimina el archivo ni rompe versiones publicadas. Los comprobantes usan el bucket privado independiente `project-receipts`.

La plantilla, tipografía, colores y menú son configuración institucional. La vista previa usa `SiteFrame` y `PageSections`, los mismos componentes del portal, con interacción desactivada. Noticias, personal, eventos y reconocimientos se leen de fuentes públicas de la institución. Las imágenes individuales de galería y las plantillas se interpretan igual en la vista previa y la página publicada.

Los estilos están aislados en `portal.module.css`. Las propuestas de SQL pendientes se documentan en `supabase/proposals/projects/README.md`. La prueba local no sustituye revisar el backend de integración y completar el recorrido de guardar, cargar imágenes y publicar antes de producción.

Publicar guarda la nueva versión en el servidor sin actualizar ni interrumpir las páginas que los visitantes ya tienen abiertas. El portal consulta al cargar una vista, cambiar sus parámetros de consulta por navegación o solicitar una actualización explícita (por ejemplo, «Actualizar datos» en Transparencia o «Reintentar» ante un error). No consulta por temporizadores, foco, cambios de visibilidad, eventos de almacenamiento ni avisos de publicación de otras pestañas. Para ver una nueva publicación en una vista ya abierta, el visitante debe recargarla. Guardar un borrador no publica cambios. La página pública aplica la misma plantilla que la vista previa.
