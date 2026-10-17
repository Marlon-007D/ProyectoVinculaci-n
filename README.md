# Portal público institucional

Módulo de portal público (responsable: Axel Molina). Esta rama contiene solo:

- `src/modules/site/`: portada, páginas, navegación, pie y estilos del portal.
- `src/core/supabaseClient.ts`: cliente de Supabase compartido (no modificar aquí).

## Ejecutar

```bash
cp .env.example .env       # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Abre `http://localhost:5173/?institution=<slug-de-la-institucion>`.

## Verificar

```bash
npm run typecheck
npm run build
```

No incluye los módulos de administración, DECE, proyectos ni simuladores; cada uno vive en su propia rama.

## Secciones de otros módulos

El portal puede mostrar secciones de simuladores, transparencia de proyectos y DECE. Están registradas en
`src/modules/site/components/External/ExternalSection.tsx`:

| Tipo de sección (editor) | Módulo que la habilita | Responsable del componente |
|---|---|---|
| `transparency` | `projects` | Marlon |
| `simulators` | `simuladores` | Brigitte |
| `dece_info` | `dece` | Elkin |

Hoy cada tipo muestra solo un marcador en desarrollo. Para integrar un módulo:

1. El responsable exporta su componente público desde `src/modules/<modulo>/public.ts`.
2. En `ExternalSection.tsx` se reemplaza el marcador de ese tipo por el componente importado.
3. El componente solo se muestra si `module_settings` tiene el módulo habilitado para la institución.

Nota para Dylan: `module_settings` tiene RLS por institución. Si los visitantes sin sesión no pueden leerla,
las secciones quedarán ocultas. Puede resolverse con una función pública, como ya existe para proyectos.

## Galería de imágenes (`gallery`)

Propiedades de la sección:

- `title` (opcional): título de la galería.
- `limit` (opcional): número máximo de imágenes, hasta 24.
- `items`: lista de `{ "media_id": "<uuid de media_assets>", "alt": "texto alternativo", "caption": "pie de foto" }`.

Solo se muestran archivos de tipo imagen marcados como públicos y pertenecientes a la institución activa.
El orden es el de `items`. Si ninguna imagen es válida, la sección no aparece.

Para que el editor pueda crear esta sección, debe existir su esquema en `section_type_schemas` (responsable: Marlon).

## Visibilidad del menú

El portal oculta los elementos de `menus` con `is_visible = false`, junto con sus subelementos.
Si la columna no existe, todos los elementos se muestran.

La columna la debe crear Dylan (cambio de esquema). Propuesta, sin ejecutar todavía:

```sql
alter table menus add column if not exists is_visible boolean not null default true;
```

## Accesibilidad para el visitante

En la barra superior hay un botón con el icono de accesibilidad. Al abrirlo, el visitante puede:

- **Modo oscuro:** interruptor que cambia a fondos oscuros con textos claros.
- **Alto contraste:** interruptor que marca textos, bordes y enlaces con más fuerza.
- **Tamaño del texto:** 100 %, 112 %, 125 % o 150 %. Todo el portal escala porque usa unidades relativas.
- **Restablecer:** vuelve a los valores normales.

El panel se cierra con Escape o al hacer clic fuera, y el foco vuelve al botón.
Las preferencias se guardan en el navegador del visitante (`localStorage`, clave `site-a11y-prefs`), no en la base de datos.
El enlace "Saltar al contenido" y el contorno de foco ya existían en el portal.

## Pruebas de diseño responsive (lista para ejecutar)

Abre el portal de dos instituciones con colores distintos, y en cada una revisa estos anchos:
**360 px** (teléfono), **768 px** (tableta) y **1024 px** (escritorio). Usa también **900 y 960 px**, donde cambia el menú.

Para cada ancho, marca "cumple" o "no cumple" y anota la captura si falla:

- [ ] No aparece barra de desplazamiento horizontal en ninguna página.
- [ ] El menú se abre y se cierra con el teclado y con el toque.
- [ ] Los controles de accesibilidad se ven completos y se pueden tocar sin errores.
- [ ] El título del hero se lee completo, sin cortes.
- [ ] Las tarjetas de noticias y personal ocupan una columna en 360 px.
- [ ] La galería muestra las imágenes sin recortarlas de forma extraña.
- [ ] El pie de página se lee en una columna en teléfono.
- [ ] Al usar "Saltar al contenido", el título queda visible debajo del encabezado.
- [ ] Con texto al 150 % (A+ tres veces), nada se superpone ni se corta.

## Puntos de entrada a los módulos

Cada institución tiene (una vez ejecutado `database/portal.sql`) estas páginas y enlaces en el menú principal:

| Enlace del menú | Página (slug) | Sección que muestra | Responsable |
|---|---|---|---|
| Simuladores | `simuladores` | `simulators` | Brigitte |
| Transparencia | `transparencia` | `transparency` | Marlon |
| DECE | `dece` | `dece_info` | Elkin |

Hasta que el módulo exporte su componente público, la sección muestra el aviso "próximamente" solo si el módulo está habilitado.
Para que los visitantes sin sesión vean la sección, `module_settings` debe ser legible para ellos (ver la nota de Dylan).
