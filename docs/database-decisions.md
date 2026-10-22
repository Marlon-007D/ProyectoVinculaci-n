# Database decisions — Phase A

Status: Phase B baseline applied. A read-only PostgreSQL inspection on 17 October 2026 verified that `public` was empty, Storage had zero buckets, and no `supabase_migrations` schema existed. A pre-migration manifest was captured and the active Drizzle migrations created the protected invoice catalog, invoices, and invoice items. No Auth, Storage, or provider-managed schema was modified.

## Scope inspected

The active routes in `src/app/router/AppRouter.tsx` cover home, the invoice/converter/interest simulators, courses, news, events, honors, academic periods, and a reports hub. Their primary source files are:

| Area | Observed source of data / behavior | Persistence observed |
|---|---|---|
| Home | `src/features/home/pages/HomePage.tsx` | Derived display; no independent data store identified. |
| News, events, honors, periods | `src/features/academic-content/types/academicContent.types.ts`; `src/features/academic-content/components/AcademicContentManager.tsx`; `src/features/academic-content/services/academicContentStorage.ts`; `src/features/academic-content/mocks/academicContentMock.ts` | CRUD in tenant-filtered `localStorage`, key `simulaedu.academic-content.v1`. |
| Courses and units | `src/features/courses/mocks/schoolModulesMock.ts`; `src/features/courses/mocks/schoolCoursesMock.ts`; `src/features/courses/pages/SchoolCoursesPage.tsx` | Static mock data; no catalog CRUD/persistence found. Module-to-course mapping is represented by `courseIds`. |
| Questions and evaluations | `src/features/courses/mocks/schoolQuestionMock.ts`; `src/features/courses/components/QuestionBank.tsx` | Question definitions are mocks. Progress, answers, attempts, timing, score, and history are saved per browser in `localStorage`. |
| Invoice product catalog | `src/features/simulators/invoice/services/invoiceProductService.ts`; active Drizzle schema and legacy SQL retained under `supabase/legacy-migrations/` | Six seeded products are read from Supabase. Only rows explicitly marked public, active, and unassigned are visible to anonymous clients; catalog writes stay denied. |
| Simulated invoices | `src/features/simulators/invoice/types/invoice.types.ts`; `src/features/simulators/invoice/services/invoiceRepository.ts`; `src/features/simulators/invoice/hooks/useInvoiceSimulator.ts` | CRUD persists to Supabase. Before Auth integration, RLS scopes demo rows to a random per-tab capability; no invoice data is stored in `localStorage`. The trusted server repository remains prepared for institution/user ownership. |
| Converter and interest | `src/features/simulators/converter/`; `src/features/simulators/interest/` | Local calculations; no persisted business records found. |
| Theme/sidebar preferences | `src/features/themeUser/hooks/useThemeUser.ts`; `src/app/App.tsx` | Browser preferences only; no database entity proposed. |
| Reports | `src/features/academic-content/pages/ReportsHubPage.tsx`; honor PDF generation in `src/features/honors/services/createRecognitionPdf.ts` | No independent report tables or persisted report records found. |

No login, session consumer, role check, membership lookup, or authorization service was found. `src/core/supabase/supabaseClient.ts` sends the public anon key to REST. It does not establish user identity.

## Existing migration baseline

Files inspected read-only:

- `supabase/legacy-migrations/20261014120000_create_invoice_products.sql`
- `supabase/legacy-migrations/20261015100000_add_invoice_product_stock.sql`
- `supabase/legacy-migrations/meta/_journal.json`
- `drizzle/0000_baseline_invoice_catalog.sql` through `drizzle/0003_enforce_simulated_invoice_security.sql`

The legacy SQL migrations create/seed `public.invoice_products`, enable RLS, and grant anonymous/authenticated `SELECT` of active rows. The second migration adds `stock`. They were never applied and now live outside the active migration directory. The active Drizzle ledger created the equivalent catalog schema without seed data, then forced RLS and revoked access from `PUBLIC`, `anon`, and `authenticated`. It also created protected `invoices` and `invoice_items` tables.

The baseline conflict is resolved: `drizzle/` is the sole active migration history and its metadata is recorded in the remote `drizzle.__drizzle_migrations` ledger. Migration `0004` restores public read access only for explicitly published, active, unassigned catalog rows; it does not grant catalog writes or invoice access.

## Code-to-column mapping

| Frontend field / state | Proposed SQL | Transformation / note |
|---|---|---|
| `AcademicContentEntry.institutionId` | `institution_id` | FK to the canonical institution table. Do not map current hardcoded mock ID directly as a production UUID. |
| `kind: 'period'` | `academic_periods` row | `title`, `startDate`, `endDate`, `isCurrent` become `title`, `start_date`, `end_date`, `is_current`. |
| `kind: 'news' \| 'event'` | `academic_publications` row | `kind`, `title`, `description`, `status`; use distinct SQL date names after confirming whether UI `date` means publication date or event date. |
| `periodId` | `period_id` | Empty string in UI/local records must map to SQL `NULL` or a verified FK, never `''`. |
| `location`, `sourceName` | `location`, `source_name` | Optional text. |
| `sourceUrl` | `source_url` | Present in the shared type, mocks, and legacy modal; absent from the newer full-page editor. Confirm whether to retain. |
| `author` | `author_name` and later `author_user_id` | Current values are display strings, not authenticated identities. Add the Auth FK only after the external contract is agreed. |
| `imageUrl` / block `src` | `cover_storage_path` / `storage_path` | Current uploaded images are compressed JPEG data URLs stored in `localStorage`; future upload should store bytes in Supabase Storage and only persist object paths in PostgreSQL. |
| Section `id`, `title`, block IDs and types | `publication_sections`, `publication_blocks` | Store order as integer `position`; paragraph text as `body`; image alt/caption as text. |
| Honor `studentName`, `grade`, `distinction`, `honorCategory`, `officialOrder`, `schedule`, `modality`, `campus`, `status` | `honor_assignments` | Keep student name as text; no student roster/identity model exists. Validate official distinction rules in the trusted database/backend too. |
| `SchoolModule.courseIds` | `course_modules`, `module_courses` | Normalize the ID array into a many-to-many join table. |
| Course `id`, `name`, `description`, `coverImage`; unit `title`, `description` | `courses`, `course_units` | Course and unit IDs/positions need stable values; current evaluation keys use course ID and topic title. |
| `CourseQuestionSet` / `AssessmentQuestionSet` | `assessments`, `assessment_questions` | Heterogeneous question data may use a validated public payload; correct answers/rubrics must not be returned to student clients. |
| `SavedProgress` / `AttemptMetrics` | `evaluation_attempts`, `attempt_answers` | Split attempt metrics from per-question response JSON. Requires authenticated user and course offering/enrollment contracts. |
| `InvoiceProduct` / REST row | `invoice_products` | `unitPrice` → `unit_price`; the current REST SELECT also expects `source_name`, `source_url`, `stock`, `is_active`. Query currently has no institution predicate. |
| `SavedInvoice` | `invoices` | Customer, identification, issue date, payment method, created time and totals. Identification must be fictitious for educational use and protected as personal data. |
| `InvoiceLine` | `invoice_items` | Preserve description and unit-price snapshots; `productId` nullable. `stock` and `isAvailable` are catalog state, not historical invoice-line fields. |
| Converter/interest inputs and results | None | No durable use or CRUD found. Keep as frontend calculations. |
| Theme and collapsed sidebar | None | User-interface preferences in local storage only. |

## Proposed domain tables and classification

| Table | Status from code | Key columns / constraints to carry into schema design |
|---|---|---|
| `institutions` | Ownership unresolved with external Auth/administration team | `id`, `name`, `status`; do not create until table ownership and canonical identifiers are agreed. |
| `academic_periods` | Confirmed data aggregate | Institution FK; date-order check; one current period per institution via partial unique index. |
| `academic_publications` | Confirmed data aggregate | Institution FK; kind check (`news`,`event`); status check (`draft`,`published`); optional period FK; differentiated date columns. |
| `publication_sections` | Confirmed | Publication FK; integer position. |
| `publication_blocks` | Confirmed | Section FK; type check (`paragraph`,`image`); content-shape check; integer position; Storage path, never base64. |
| `honor_assignments` | Confirmed | Institution/period FKs; category/status checks; preserve official distinctions and duplicate-prevention rule. Do not introduce a `students` table without a legitimate roster. |
| `course_modules`, `courses`, `module_courses`, `course_units` | Probable persistent catalog | Institution boundaries; same-institution composite references; stable IDs and positions. Existing code contains no catalog CRUD. |
| `course_offerings`, `course_teachers`, `course_enrollments` | Product requirement, not current frontend data | Required by the accepted multi-period and authorization decisions; the current UI has no offering, teacher assignment, or enrollment model. |
| `assessments`, `assessment_questions` | Probable persistent content | Question type discriminator and position; separate private key/rubric from student-readable content. |
| `evaluation_attempts`, `attempt_answers` | Confirmed local progress, target schema depends on identity/offering | User/enrollment/assessment references; server-enforced attempt count, duration, and grading. |
| `invoice_products` | Confirmed by REST contract and existing migrations | Add institution ownership only after canonical institution table is established; reconcile public read policy. |
| `invoices`, `invoice_items` | Confirmed local CRUD | Owner and institution isolation; positive quantity; numeric snapshots; no legal/SRI behavior. |

No table is proposed for converter/interest calculations, theme, or sidebar state.

## Security and RLS decision matrix

Roles below are product requirements from the supplied plan, not roles currently implemented in React.

| Data | Anonymous | Pending/unapproved user | Student | Assigned teacher | Institution admin | Superadmin |
|---|---|---|---|---|---|---|
| Published news/events | Read only, same active institution if public release is approved | Same public rows only | Same public rows only | Same public rows only | Read/manage own institution | Global management only via agreed secure contract |
| Draft publications/periods | Deny | Deny | Deny | Deny unless specifically authorized | Own institution only | Secure global operation |
| Published honors | Public read only after policy for student names/photos is approved | Public rows only | Public rows only | Public rows only | Manage own institution | Secure global operation |
| Course catalog/offerings | Deny | Deny | Enrolled offerings only | Assigned offerings only | Own institution | Secure global operation |
| Questions/solutions | Only safe published payload may be read by eligible student | Deny | Enrolled, published payload only; never solution/rubric | Assigned offering, authorized reporting | Own institution | Secure global operation |
| Attempts/answers | Deny | Deny | Own attempts only | Students in assigned offerings, according to report permissions | Own institution per policy | Secure global operation |
| Products | Public active catalog only if institution isolation can be enforced | Same intended catalog read | Same intended catalog read | Same intended catalog read | Own institution management | Secure global operation |
| Invoices/items | Deny without a session capability; temporary simulator rows only within that capability | Deny institutional records | Own simulated invoices only after Auth/RLS contract | Authorized academic context only | Own institution if product policy allows | Secure global operation |
| Storage objects | Public published images only if intentionally public | Deny writes | No upload rights inferred | Upload only when authorized | Own institution paths | Secure global operation |

Until the Auth team supplies verified `user_id`, institution, role, approval state, and membership contracts, private tables must have RLS enabled with no permissive policies. Do not trust a React role, a client-supplied `institution_id`, or editable Auth `user_metadata`. Do not include `DATABASE_URL` or `service_role` in the Vite bundle.

## Storage/bucket findings

No bucket name, Storage client call, upload policy, or object-path field exists in the project. `AcademicPostPreviewPage.tsx` compresses selected images to JPEG data URLs (maximum dimension 1400 px, quality 0.78) and stores them in the academic `localStorage` document. Other course/product imagery is static or externally hosted. `createRecognitionPdf.ts` loads bundled avatar assets for PDF generation.

Future recommendation: use a dedicated bucket for institutional publication media, path-prefixed by verified institution and publication IDs. Keep draft objects private; published public images may be served publicly only after editorial/consent policy approval. Restrict upload/delete by verified membership and role. Store paths in publication rows/blocks. Supabase `storage` tables are provider-managed and must not be declared or altered via Drizzle. Do not migrate base64 strings into SQL.

## Identifiers and integrity gaps

- `tenantInstitution.id` is `ue-rio-guayas`, while the displayed name is `UE. Puerto Limón`; reconcile before importing any mock as canonical institutional data.
- Mock records contain demo IDs such as `academic-demo-*` and `period-pl-*`; preserve them only as `legacy_id` during an explicit, verified import.
- `AcademicContentEntry` combines period/publication/honor fields and fills unused fields with empty strings. SQL should use separate aggregates and nullable FKs, with UI-to-DB adapters.
- Honor duplicate validation uses normalized period/campus and compares student name or distinction in application code. Enforce the agreed rule at the database/trusted service boundary.
- Invoice mock lines do not consistently contain fields required by `InvoiceLine`; distinguish invoice snapshots from catalog stock state.
- Evaluation local-storage key uses a course ID and topic title, not a stable unit/assessment identifier or user identity.
- The query to `invoice_products` does not filter by `institution_id`; tenant isolation must be enforced at the database and then reflected in the client query.
- `academic-content` still contains an older modal with URL fields while the current full-page editor uses local file selection. Confirm legacy URL data handling before migration.

## Open decisions before Phase B

1. Auth/administration owner and canonical schema for `institutions`, profile/membership, approval status and role claims.
2. The active ledger is Drizzle (`drizzle/` and remote `drizzle.__drizzle_migrations`). Do not execute the retained legacy SQL files.
3. Whether existing Supabase migrations or Drizzle migrations are the sole source of truth. Current Supabase SQL exists while Drizzle journal is empty.
4. Canonical institution ID strategy and a verified mapping for legacy local/mock IDs.
5. Public publication and honor visibility, especially approval/consent requirements for students' names and images.
6. Meaning of publication `date` per kind and whether `source_url` is retained.
7. Bucket public/private policy and verified upload authorization.
8. Whether the course catalog, questions, offerings, enrollments and grade records are managed by this module or another content team.
9. Whether client invoice fields remain fictitious and which identity owns each simulated invoice.

## Migration and rollback outline

1. Create a public-schema backup manifest before each remote migration using `npm run db:backup-public`.
2. Use the Drizzle ledger only: generate reviewed migrations into `drizzle/` and apply them with `npm run db:migrate`.
3. Establish the schema in Drizzle first, then generate/review SQL without `push`.
4. Version RLS, grants, partial indexes, checks, and Storage policies in the same Supabase migration sequence; test with local Supabase/Postgres and role scenarios.
5. Before applying, take a backup and capture schema/data state; produce reviewed forward and rollback steps. Never apply remotely without explicit approval.
6. Import local storage only through an opt-in export/preview/confirmation flow after identity and institution are verified. Retain local copies until the imported result is checked. Import images to Storage through an authorized flow.

The four baseline migrations have been generated and applied in Phase B. Database tests confirm RLS is enabled and forced, no policies exist, and both API roles are denied.
