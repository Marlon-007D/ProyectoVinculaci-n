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
  - `src/modules/site/components/Layout/PrivateWorkspace.tsx` es la base acordada para unificar.
  - DECE usa todavía la suya (`src/modules/dece/components/provisional-shell`), y simuladores la de `src/shared/components/Sidebar`.
- **Avisos y confirmaciones:**
  - Toast compartido en `src/shared/components/Toast`, con `notify` + `NotifyBridge` (`src/shared/components/Toaster`) y `confirmAction` + `ConfirmHost` (`src/shared/components/ConfirmDialog`).
  - Pendiente de unificar: el Toast propio de admin (`src/modules/admin/auth/Toast`) y sweetalert2 (solo en DECE).
- **BD real:**
  - Tablas: `profiles`, `memberships`, `roles`, `institutions`, `module_settings` (por institución), `admin_tenant_member_modules` (por usuario), `admin_tenant_invitations` y `admin_membership_requests`.
  - El SQL de admin está en `src/modules/admin/backend/0NN_*.sql`.
- **Edge Function `admin-tenant-invite`:**
  - Se genera con `node src/modules/admin/backend/buildAdminEdgeBundle.mjs`, que escribe `admin-tenant-invite.deploy.txt` y `supabase/functions/admin-tenant-invite/index.ts`.
  - `adminEdgeBundle.test.mjs` falla si alguno de los dos queda desfasado.
- **Dos clientes de Supabase:** `src/core/supabaseClient.ts` (general) y `src/core/supabase/` (simuladores y lecturas públicas).

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

**Pendiente**, en este orden:
1. Bloque 3.1 y 3.2: parpadeo del skeleton y redirecciones. `returnTo` de `ProjectsWorkspace` no lo usa nadie.
2. Bloque 2.1 a 2.3: barra única, avisos y confirmaciones.
3. Bloque 4: DECE.
4. Bloque 2.4 a 2.6: primitivas, encabezado y migas de pan.

El plan completo está en la sesión del 29/10/2026.
