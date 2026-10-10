# Módulo DECE

DECE presenta panel, directorio y fichas. Consume los tokens CSS globales de la aplicación y recibe datos o acciones mediante props. No consulta Supabase ni decide la institución o el tema activo.

## Carpetas

- `pages/`: composiciones de pantalla. Cada página decide qué componentes presenta, no dónde se guardan los datos.
- `components/`: piezas reutilizables de interfaz, como campos, navegación de secciones, nombre de estudiante y tarjetas de resumen.
- `types/`: contratos TypeScript de estudiantes, pantallas, iconos y campos.
- `data/`: datos demostrativos y configuración estática de secciones. Sustituir estos datos por servicios no debe cambiar la responsabilidad de las páginas.
- `services/`: espacio reservado para acceso a datos específico de DECE cuando se defina esa integración. No contiene consultas hoy.
- `dece.module.css`: estilos del módulo. Las reglas globales están limitadas al contenedor `appShell`; los colores de tema deben expresarse mediante variables CSS.

## Tema

El arranque de la aplicación inicializa el tema en `src/core/theme/`. DECE solo consume esas variables. La futura integración de datos debe reemplazar el lector de tema general, no introducir una lectura de `themes` dentro de una página o componente DECE.
