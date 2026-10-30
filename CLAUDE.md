# CLAUDE.md

Guía para Claude Code en este repositorio. Rama de trabajo: `develop-unificacion` (creada desde `origin/develop` el 29/10/2026 para la presentación del proyecto completo). El responsable de la rama (Marlon) autoriza modificar cualquier módulo; los push y PR los hace él.

## Contexto

Plataforma institucional multi-institución (React 19 + TypeScript + Vite + Supabase) para 4 Unidades Educativas (`ue-luz-de-america`, `ue-el-esfuerzo`, `ue-la-concordia`, `ue-puerto-limon`).

| Módulo | Ubicación | Autor original |
|---|---|---|
| Portal público | `src/modules/site/` | Axel |
| Simuladores, cursos, publicaciones | `src/app/`, `src/features/` | Brigitte |
| Proyectos, transparencia, editor del portal | `src/modules/projects/`, `src/modules/portal-editor/` | Marlon |
| DECE | `src/modules/dece/` | Elkin |
| Administración, auth y esquema institucional | `src/modules/admin/`, `src/core/` | Dylan |

`AGENTS.md` describe las reglas de estilo (CSS Modules, Material Design 3 en morado pastel, sin sombras, sin emojis, sin `!important`). Decisión del 29/10/2026: en todo el panel se usan iconos de **lucide-react**, aunque `AGENTS.md:28` pida Material Symbols.

## Reglas de trabajo

- No hacer push ni PR. Commit local al terminar cada bloque.
- No ejecutar SQL en Supabase. Los cambios de BD van como propuesta sin aplicar en `supabase/proposals/<modulo>/`, con consulta de diagnóstico previa.
- Nunca usar `service_role` ni claves privadas en el frontend. Las operaciones privilegiadas van por Edge Function o RPC.
- Playwright: solo navegar, sin enviar formularios que guarden datos.
- `.github/workflows/quality.yml` solo se modifica con permiso explícito.

## Comandos

```powershell
npm run dev               # Vite en http://localhost:5173 (?institution=<slug|uuid>)
npm run lint              # tsc estricto (strict, noUnusedLocals/Parameters); no hay ESLint
npm run build             # prebuild (exige VITE_SUPABASE_URL/ANON_KEY públicas) + tsc -b + vite build
npm run test:projects     # supabase/tests/*.test.cjs (proyectos, portal, editor, integración)
npm run test:admin        # src/**/*.test.mjs salvo *.database.test.mjs
npm run test:integration  # tests/security + public_client + invite_institution_user
npm run test:coverage     # pruebas de test:admin con lcov en coverage/lcov.info (lo usa SonarQube)
npm run test:all          # projects + admin + integration
```

- **Pruebas de BD:** las `*.database.test.mjs` usan PGlite en `tmp/pending-db-test` o en `PGLITE_TEST_MODULE`. No entran en los scripts.
- **Arneses `*.test.cjs`:** transpilan TS y lo ejecutan en `vm` con un `require` en lista blanca. Si un módulo bajo prueba añade un import, hay que registrarlo en el arnés o falla con `Unexpected import`.
- **Una sola prueba:** `node --test --test-name-pattern="texto" <archivo>`.

## Arquitectura (verificada en esta rama)

- **Rutas** (`src/App.tsx`): `BrowserRouter > AuthProvider > TenantProvider > RoutesWithAuth`, envuelto en `ErrorBoundary`.
  - `/login` → `src/features/auth/pages/AuthPage.tsx`.
  - `/panel/admin|instituciones|superadmin` → admin.
  - `/panel/cursos|publicaciones` → `AcademicManagementRoutes`.
  - `/panel/dece/*` → DECE.
  - `/panel/proyectos|portal` → `ModuleBoundary` + `ModuleRoutes` (lazy).
  - `/panel/simuladores/*` → `src/app/App.tsx`, con enrutador propio sin react-router.
  - `/panel/*` desconocida → `ErrorPage` 404.
  - `/*` → `SiteApp`.
- **Sesión:**
  - `src/core/AuthContext.tsx`: login, logout y MFA. El logout lleva a `/?institution=<id>` mediante `src/modules/admin/auth/logoutDestination.ts`.
  - `src/core/TenantContext.tsx`: institución activa y `hasModuleAccess`.
  - `src/modules/admin/auth/authenticatedDestination.ts`: destino según el rol de un usuario con sesión que entra a `/login`.
- **Barra lateral del panel:**
  - `PrivateWorkspace.tsx` es la única barra: riel de 76 px que se ensancha con overlay, cajón móvil accesible. Todos los ítems son pastillas de primer nivel (sin grupos ni submenús); el catálogo y el filtro por rol/módulo están en `navItems.ts` (`visibleNavItems`, con prueba). DECE (5 ítems) solo para `dece_staff`; Cursos y Publicaciones solo para administradores; Simuladores (3 ítems) según el módulo.
  - El estado activo sigue también a `history.pushState` (`useBrowserPathname`), porque DECE navega por su cuenta.
  - Simuladores: `/panel/simuladores/{facturacion,conversor,interes}` en `PanelSimulator`; las rutas viejas redirigen. La app vieja (`src/app/App.tsx`) y `shared/components/Sidebar` se eliminaron. **Quedan sin uso** `src/app/router/AppRouter.tsx` y sus páginas de cursos/noticias/eventos/honores: confirmar con el equipo antes de borrarlas (las páginas de cursos del estudiante solo vivían ahí).
- **Portal público con sesión:** `TenantContext` redirige `/?institution=` al panel solo en la portada; las páginas públicas (`?honores=1`, `?noticia=`, `?evento=`, `?simulator=`…) se quedan (`isPublicPortalSearch`).
- **Avisos y confirmaciones:**
  - Único sistema de avisos: sonner con `notify` (`src/shared/components/Toaster`); `AppToaster` y `ConfirmHost` se montan una vez en `App.tsx`. `useToast` (compartido y de admin) son adaptadores sobre `notify`.
  - Confirmaciones con `confirmAction`. Pendiente: migrar sweetalert2 (solo en DECE y AuthPage).
- **BD real:**
  - Tablas: `profiles`, `memberships`, `roles`, `institutions`, `module_settings` (por institución), `admin_tenant_member_modules` (por usuario), `admin_tenant_invitations` y `admin_membership_requests`.
  - El SQL de admin está en `src/modules/admin/backend/0NN_*.sql`.
- **Edge Function `admin-tenant-invite`:**
  - Se genera con `node src/modules/admin/backend/buildAdminEdgeBundle.mjs`, que escribe `admin-tenant-invite.deploy.txt` y `supabase/functions/admin-tenant-invite/index.ts`.
  - `adminEdgeBundle.test.mjs` falla si alguno de los dos queda desfasado.
- **Dos clientes de Supabase:** `src/core/supabaseClient.ts` (general) y `src/core/supabase/` (simuladores y lecturas públicas).

## MFA (segundo factor)

- **Interruptor:** `VITE_MFA_ENABLED` (por defecto `false`, modo demo), leído solo en `src/core/mfaConfig.ts`. Con `false`, `AuthContext` nunca desafía ni exige enrolamiento por ningún método de acceso (contraseña, Google, enlace por correo, otra pestaña); `TenantContext`, `AdminSessionPolicy`, `AdminRoutes` y `MfaEnrollment` lo heredan porque leen `mfaRequired`/`mfaEnrollmentRequired` de `useAuth`.
- **Reactivar:** `VITE_MFA_ENABLED=true` en `.env.local` o en el entorno de Vercel/Netlify **antes del build**. El código de MFA no se borra (HU-02).
- **Base de datos:** la exigencia `aal2` del lado servidor es aparte; ver `supabase/proposals/admin/`. Con el interruptor en `false` pero la BD exigiendo `aal2`, las RPC que lo exigen seguirán rechazando.

## CI y SonarQube

- **Workflow** `quality.yml`: jobs `build`, `sonarqube` y `snyk-code`, los dos últimos con `needs: build`.
  - `build` necesita los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Sin ellos falla el prebuild, y por eso Sonar y Snyk aparecían como «Skipped».
  - `sonarqube` ejecuta `npm run test:coverage` antes del análisis y necesita `SONAR_TOKEN` + `SONAR_HOST_URL` o `SONAR_ORGANIZATION`.
  - `snyk-code` necesita `SNYK_TOKEN`.
- **`sonar-project.properties`:**
  - analiza solo `src/modules/admin`;
  - lee la cobertura de `coverage/lcov.info`;
  - el quality gate se define en el servidor.

## Estado (29/10/2026)

**Bloque 1 (estabilidad) hecho:**
- Arneses de prueba actualizados.
- `ErrorBoundary` y 404 de `/panel/*` restaurados.
- Claves duplicadas del portal corregidas.
- Contraseña de registro de 12 a 128 caracteres, como la Edge Function.
- `strict` activado.
- Scripts de pruebas y cobertura.

**Hecho (30/10/2026):** layout privado único sin parpadeo, `returnTo`, interruptor `VITE_MFA_ENABLED`, toast único con sonner, barra plana única (DECE, Inicio y Simuladores como ítems), portal público sin redirección al panel, selector de institución que se mantiene (`institutionSwitchSearch`), paginación DECE sin NaN, textos de carga sustituidos por skeletons, estado vacío común (`EmptyState`) en Cuadro de honor.

**Hecho además:** estado de sesión en el portal público (solo «Iniciar sesión» o «Salir»), cierre de sesión en otra pestaña (`remoteSignOutTarget`, ErrorPage de sesión/institución), editor del portal en bloques con imagen por elemento (descripción obligatoria) y páginas en orden lógico, avisos en línea de publicaciones y cursos a `notify`, colores de Publicaciones en azul, aviso de contenido nuevo del portal (Realtime, sin sondeo), un solo `Skeleton` estático en el portal (`keepPrevious` en `useAsync`) y sin parpadeo de imágenes.

**Pendiente:**
1. DECE visual completo: campos, tarjetas y paginación con el estilo de proyectos (hoy solo botones, filtros y chips vía `dece-buttons.css`); unificación visual de admin, cursos e Inicio, botones/tarjetas/encabezados/migas/vista tabla-tarjetas compartidos; quedan unos 5 «Cargando…» pequeños dentro de secciones.
2. Admin pendiente: persistencia en asignar acceso/aprobar solicitud, `AbortController` en efectos, correos con `trim().toLowerCase()` en `AuthPage.login`.
3. SQL sin aplicar (todos en `supabase/proposals/`): MFA (`admin/202610300000_mfa_switch.sql`), Cuadro de honor por membresía (`honors/202610300300_honors_membership_rls.sql`, causa: `get_current_institution_id()` permite una sola institución), diagnóstico y publicación de distinciones (`honors/202610300200_*`), activación de simuladores por institución (`simulators/202610300100_*`). Pendiente de revisar también las políticas de `events`, `site_settings`, `themes`, `media_assets` y `staff`, que pueden depender de la misma función.
4. Migrar sweetalert2 a `notify`/`confirmAction` y quitar la dependencia.
5. Acceso al panel desde el portal público: el encabezado público solo ofrece «Salir» con sesión; definir si debe haber un enlace al panel. El login con Google aún aterriza en `/panel/admin`.
6. Gestión de simuladores por el admin: no existe en ninguna rama (los tres simuladores son fijos y se controlan con el módulo `simuladores`); `/panel/simuladores` redirige a `/panel`, y `PanelSimulator` y `AppRouter` con sus páginas quedan sin uso.
7. El aviso de contenido nuevo necesita aplicar `ACTIVAR_AVISOS_PUBLICACION.sql` (tabla `portal_publication_revisions`).
8. Error 1 (`/panel/admin` con «Algo salió mal») no reproducido; si reaparece, pedir la línea roja de la consola.
