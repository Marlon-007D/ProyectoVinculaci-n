# Editor del portal institucional

El editor comparte las tablas de configuración con el portal de Axel. No introduce otro sistema de sesión ni otra institución activa: utiliza `AuthContext`, `TenantContext` y el módulo `portal` existentes.

## Contrato de integración

`PortalSnapshot` en `contract.ts`, versión 1:

- Página: `title`, `slug`, `is_homepage`.
- Identidad: `settings.site_title`, `logo_url`, `footer_text`.
- Tema: `theme.primary_color`, `secondary_color`, `font_family` y `template` (`classic`, `cards`, `editorial`).
- Menú: lista ordenada de `{label, url}`.
- Secciones: `{id, type, position, is_visible, properties}`. Tipos del catálogo común: banner, texto, noticias, eventos, personal, cuadro de honor, galería, enlaces, simuladores, transparencia y redes.

`normalizeSnapshot` conserva las propiedades existentes y añade los campos de banner y enlaces consumidos por `site/PageSections`. No modifica componentes de Axel. Las limitaciones del renderizador público de Axel (por ejemplo, aplicar la plantilla o mostrar imágenes de galería) siguen siendo parte de su integración; la vista `/portal` ya usa las tres plantillas y las imágenes del contrato.

`portal_editor_save` recibe institución, página (null para nueva), revisión esperada, snapshot y acción de publicación. Devuelve página, revisión, estado y snapshot. El servidor comprueba permisos, módulo, catálogo, enlaces, revisión e institución; serializa publicaciones por institución.

Los borradores se guardan en `portal_editor_drafts`, sin acceso anónimo. `publication_versions` contiene versiones publicadas; publicar actualiza tema, configuración, menús, portada, secciones y versión en una sola transacción. Un error revierte la transacción completa. Las revisiones obsoletas se rechazan para no sobrescribir trabajo concurrente.

Noticias, personal, eventos y reconocimientos se consultan desde sus fuentes institucionales; no se administran sus registros desde el editor. Los reconocimientos utilizan `public_honors`, sin consultar fichas de estudiantes. La configuración general (tema/menú) es institucional: al publicar cualquier página, se aplica a todo su portal.

## Uso

1. Abrir `/panel/portal`, seleccionar institución y página o crear una nueva.
2. Configurar identidad, plantilla, enlaces y secciones. Cada imagen requiere texto alternativo.
3. Guardar borrador y previsualizar. La previsualización muestra el contenido editado; las listas académicas se consultan en el portal publicado.
4. Un administrador publica. El enlace «Ver portal público» abre la página aprobada.
5. Si otro usuario guardó antes, recargar el listado y volver a seleccionar la página antes de reintentar.

## Logotipo e imágenes

«Seleccionar imagen» permite cargar PNG, JPG o WebP de hasta 5 MB y 6000 × 6000 píxeles. Se valida el contenido del archivo y se comprueba que pueda decodificarse. También se admite una URL HTTPS. El logotipo mantiene sus proporciones; las imágenes de contenido requieren descripción alternativa.

Las cargas se guardan en `portal-assets`, dentro de la carpeta de la institución, con un nombre aleatorio. **El archivo es público desde su carga**, aunque la página siga en borrador: usar únicamente imágenes autorizadas para difusión pública. La migración `202610200004_portal_assets.sql` comprueba los permisos de edición, módulo y MFA en el servidor. Los comprobantes financieros usan el bucket privado independiente `project-receipts`.

Cada reemplazo crea una URL nueva. «Quitar de esta página» retira la referencia del borrador; no elimina el archivo ni rompe versiones ya publicadas. La limpieza de archivos sin referencias corresponde al mantenimiento administrativo, después de comprobar páginas y versiones que los utilicen.

La vista previa permite alternar escritorio y móvil; sus enlaces están desactivados para no abandonar el diseño. Los cambios pendientes requieren confirmación antes de cambiar de página o institución. Publicar aplica la página y la configuración institucional en una sola operación.

La revisión y orden de migraciones, verificación automatizada y límites de validación se documentan en `../projects/README.md`.
