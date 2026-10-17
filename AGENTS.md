# Instrucciones del proyecto

## Alcance vigente

Este repositorio cubre el trabajo asignado a **Brigitte**. No desarrollar funcionalidades de otros módulos sin una solicitud explícita.

**Responsable:** Brigitte Rodríguez.

La primera entrega se limita a tres simuladores educativos:

1. Simulador de facturación electrónica.
2. Conversor de unidades y monedas.
3. Calculadora de interés simple y compuesto.

No agregar funciones ajenas a este alcance sin una solicitud explícita.

## Estado de implementación y base de datos

- El módulo de **simuladores** está completado con persistencia en la base de datos.
- Quedan pendientes el módulo de **Cursos**, incluido **Módulos**, y el módulo de **Reportes** con sus subsecciones.
- Estos pendientes solo registran el estado del proyecto; no autorizan por sí solos su implementación. Esperar una solicitud explícita antes de trabajar en ellos.

## Tecnología

- Implementar la interfaz con React.
- Usar TypeScript para componentes, páginas, lógica y utilidades (`.ts` y `.tsx`).
- Mantener Vite como servidor y herramienta de compilación; el punto de entrada es `src/main.tsx`.
- Usar una biblioteca de iconos compatible con React (por ejemplo, `lucide-react`).
- Todos los iconos de la interfaz deben provenir de esa biblioteca: no usar emojis como iconos, botones ni elementos decorativos funcionales.

## Organización del código

- Organizar el código con la arquitectura por features indicada abajo. Los simuladores viven en `src/features/simulators/`.
- Dentro de cada simulador, separar `components/`, `hooks/`, `utils/` o `services/`, `types/` y `pages/` según corresponda.
- Guardar los datos de demostración y prueba en `mocks/`; no incrustarlos en componentes o hooks.
- Cada componente React debe tener su módulo TypeScript y estilos locales asociados; los componentes compartidos deben estar agrupados por carpeta en `src/shared/components/`.
- Reservar `src/shared/styles/globals.css` para tokens, reset, tipografía y reglas realmente globales.
- Mantener configuración de entorno en `src/core/config/`, errores comunes en `src/core/errors/` y el cliente de Supabase en `src/core/supabase/`.
- Las carpetas `news`, `events`, `honors` y `academic-periods` son solo estructura; no implementar sus funciones sin solicitud explícita.

Estructura objetivo:

```text
src/
├── app/
│   ├── router/AppRouter.tsx
│   └── App.tsx
├── core/
│   ├── supabase/supabaseClient.ts
│   ├── config/env.ts
│   └── errors/AppError.ts
├── features/
│   ├── simulators/
│   │   ├── invoice/{components,hooks,utils,types,mocks,services,pages}/
│   │   ├── converter/{components,hooks,services,utils,types,pages}/
│   │   └── interest/{components,hooks,utils,types,pages}/
│   ├── news/{components,hooks,services,types,pages}/
│   ├── events/{components,hooks,services,types,pages}/
│   ├── honors/{components,hooks,services,types,pages}/
│   └── academic-periods/{components,hooks,services,types,pages}/
├── shared/
│   ├── components/{Button,Input,Select,Card,Modal}/
│   ├── hooks/
│   ├── utils/{formatCurrency,formatDate,validators}.ts
│   ├── types/common.types.ts
│   └── styles/globals.css
└── main.tsx
```

## Diseño e interfaz

- Aplicar los principios de Material Design 3: jerarquía clara, superficies diferenciadas, estados interactivos perceptibles, accesibilidad y espaciado consistente.
- La navegación principal debe usar un `aside` lateral, con accesos a los tres simuladores.
- Buscar una estética moderna inspirada en las interfaces de Google Account: sobria, clara, ordenada y centrada en contenido.
- El color dominante es el morado, empleado preferentemente en tonalidades pastel y con contraste suficiente para texto y controles.
- Usar fondos grises suaves y neutros para reducir la saturación visual. Reservar el morado para identidad, selección, acciones importantes y estados destacados.
- Mantener diseño responsivo, legible y usable con teclado.
- No usar sombras (`box-shadow`, filtros de sombra ni elevaciones visuales). Diferenciar superficies con color, bordes suaves y espaciado.
- Evitar una apariencia genérica o artificial: la composición debe responder a tareas educativas concretas, mostrar información útil y mantener una jerarquía sobria.
- El texto de la interfaz debe ser directo y funcional. No usar frases que describan la propia interfaz como "interactiva", "realista", "inteligente" o similares.
- Preferir una paleta minimalista: superficies neutras, morado apagado como acento puntual y poco uso de etiquetas decorativas.

## Datos y comportamiento

- Usar datos mock realistas y moderados para Ecuador; no usar cifras, perfiles ni textos inflados o inverosímiles.
- Cada simulador debe permitir una interacción significativa y mostrar el resultado del cálculo o conversión inmediatamente.
- No presentar pantallas estáticas como funcionalidades terminadas.
- Durante la integración gradual con Supabase, no bloquear los simuladores ni mostrar avisos de autenticación como sustituto de una experiencia funcional. Mantener los datos del simulador en Supabase; si Auth aún no está integrado, aislar los registros de demostración con RLS y una clave aleatoria de sesión que no contenga datos personales.
- No guardar facturas, datos académicos o institucionales en `localStorage` ni usar una tabla global de escritura/lectura anónima. Reemplazar el aislamiento temporal de sesión con el contexto verificado del backend/Auth cuando llegue el contrato.
- No esperar a integrar todos los módulos para completar la experiencia de los simuladores asignados. El catálogo explícitamente público puede leerse sin sesión; las facturas y demás datos institucionales no deben exponerse públicamente.

## Calidad y verificación

- Antes de implementar, volver a leer estas instrucciones y el requerimiento actual para confirmar alcance, tecnología y diseño.
- Antes de dar una tarea por terminada, contrastar de nuevo el resultado con estas instrucciones, verificando especialmente: alcance exclusivo de Brigitte Rodríguez, los tres simuladores permitidos, `aside`, React, iconos Lucide, ausencia de emojis, datos mock realistas, interacción, ausencia total de sombras y estilo Material Design 3 en morado pastel.
- No afirmar que una funcionalidad está completa sin comprobarla en el entorno disponible.
