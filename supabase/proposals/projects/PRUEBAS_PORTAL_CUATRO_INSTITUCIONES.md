# Revisión del portal en las cuatro instituciones

**Cambio de alcance confirmado:** el usuario ya aplicó el SQL y pidió mantener el encabezado fijo. La navegación, orden y estilo son comunes a las cuatro instituciones y no se editan desde Portal Web. El nombre y logo identifican a cada institución. Los controles de submenús mencionados en la implementación anterior se retiraron.

## Actualización necesaria

Ejecutar `ACTUALIZAR_EDITOR_PORTAL.sql` completo en una consulta nueva del SQL Editor. Requiere el CRUD lógico ya instalado. Actualiza la función de guardado y restaura la agrupación «Institución → Nosotros / Oferta educativa» de El Esfuerzo. Conserva las secciones, menús anteriores y versiones; no cambia cuentas, membresías ni MFA.

Después, recargar el editor. El nuevo frontend comprueba la versión de la función antes de guardar para no perder contacto o submenús con el servidor anterior.

## Portales reales consultados sin sesión

| Institución | URL local del portal | Lectura pública |
| --- | --- | --- |
| El Esfuerzo | http://127.0.0.1:5173/?institution=ue-el-esfuerzo | 8 páginas, sin errores |
| La Concordia | http://127.0.0.1:5173/?institution=ue-la-concordia | 8 páginas, sin errores |
| Lúz de América | http://127.0.0.1:5173/?institution=ue-luz-de-america | 8 páginas, sin errores |
| Puerto Limón | http://127.0.0.1:5173/?institution=ue-puerto-limon | 8 páginas, sin errores |

La consulta `node scripts/check-public-portals.mjs` usa únicamente la clave anónima del frontend, no inicia sesión y no escribe datos. Confirmó que El Esfuerzo tenía nueve enlaces de primer nivel; las otras tres conservaban Nosotros y Oferta educativa como submenús.

La cuenta de pruebas del usuario solo dispone de acceso a El Esfuerzo. Para guardar en las otras tres se necesitan cuentas autorizadas o membresías asignadas por el administrador. No se ampliaron permisos.

## Recorrido para cada institución

1. Entrar con su cuenta autorizada y seleccionar **Portal Web → Página que estás editando → Contacto**. Confirmar el nombre de institución antes de editar.
2. Modificar un texto pequeño y guardar borrador. Recargar el editor: el cambio debe persistir. Abrir el portal anónimo: todavía debe mostrar la versión publicada anterior.
3. Publicar y abrir el portal público: debe aparecer el cambio. Repetir con Inicio y Nosotros, usando sus páginas existentes.
4. Modificar nombre, logo, contacto o pie de página. Al publicar, revisar varias páginas de la misma institución: comparten la identidad vigente. Abrir las otras instituciones: no deben cambiar.
5. Confirmar que el encabezado mantiene Inicio, Institución (Nosotros y Oferta educativa), Noticias, Contacto, Aprendizaje, Transparencia y DECE en las cuatro instituciones. Cambiar contenido o tema y publicar: el encabezado debe conservar su estructura, orden y estilo. No debe haber controles para modificar su navegación.
6. Revisar escritorio (1280 y 1440 px) y móvil (390 px): logo dentro de su espacio, nombre largo con puntos suspensivos, menú sin superponerse, vista previa llena y sin franja blanca.
7. Probar portada, texto, cifras/tarjetas, segundo botón, galerías, redes y personal. Para noticias, eventos y honores, usar **Editar los registros de esta sección**, que abre el módulo existente en otra pestaña.
8. Restaurar el texto de prueba y publicarlo. Confirmar el aislamiento usando las cuatro URLs de la tabla.

## Alcance de la edición

El editor controla las páginas existentes, identidad institucional, colores y tipografía del contenido, contacto, redes, pie y secciones. El encabezado queda fijo. Incluye campos de portada, segundo botón, fondos, cifras, listas, galerías y cantidad de registros. Personal permite escoger el directorio institucional o una lista propia de la página.

Noticias, eventos y honores conservan sus editores y reglas de publicación. Los datos de proyectos, cursos, simuladores y DECE mantienen sus respectivos módulos y permisos; sus registros no se duplican como texto del portal.

## Evidencia y límites

Las pruebas locales usan PostgreSQL temporal con cuatro instituciones y cuatro administradores separados. Comprueban contacto/redes, jerarquía de menús incluso cuando el hijo va primero, visibilidad, borrador privado, publicación, aislamiento y rechazo de ciclos y redes inseguras. También aplican dos veces el SQL incremental y verifican la reparación de El Esfuerzo.

Las pruebas automatizadas no sustituyen la revisión visual: esta sesión no dispone de navegador automatizable. La lectura anónima real se comprobó; la publicación real en las otras tres instituciones está pendiente de cuentas autorizadas.
