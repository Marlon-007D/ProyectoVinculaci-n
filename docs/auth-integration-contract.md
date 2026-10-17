# Auth integration contract — pending external owner

This document records the boundary required by the database design. It does not implement or replace Auth.

## Current repository state

- No login, session, approved-membership lookup, role resolver, or authorization provider was found.
- `src/core/auth/authorization.ts` now defines the narrow session/authorization ports and a provisional adapter that denies all access until a verified Auth provider is supplied.
- `src/core/config/tenant.ts` provides a fixed institution value, not a verified membership.
- `src/core/supabase/supabaseClient.ts` sends the public anon key to REST and does not expose an authenticated user/session.
- The value “Brigitte Rodríguez” and other author labels are display text, not proof of identity.
- Existing localStorage records cannot be attributed to a verified user or institution automatically.

## Required Auth-owned contract

Before private repository operations are enabled, the Auth owner must provide a server-verified session context containing:

```ts
export interface SessionContext {
  userId: string
  institutionId: string | null
  role: 'superadmin' | 'institution_admin' | 'teacher' | 'student' | null
  membershipStatus: 'pending' | 'approved' | 'rejected' | null
}
```

The contract must identify the authoritative source for each value, how session expiry is handled, and how one account's single institutional membership and the superadmin exception are represented. The UI must not construct this context from a form, URL, localStorage, or editable `user_metadata`.

## Integration rules

- Do not create `user_profiles`, `institution_memberships`, `membership_requests`, admin claims, roles, or Auth screens in this module until the Auth owner approves the table names, ownership, FK constraints, and claims contract.
- Domain services may depend on a narrow `SessionProvider`/`AuthorizationContext` port; its provisional private-data implementation must deny access, not fabricate a user or role.
- PostgreSQL RLS must independently validate `auth.uid()`, approved membership, institution, and resource ownership/assignment.
- Anonymous access never grants institutional writes. The invoice simulator's temporary demo rows are the sole exception: RLS scopes them to a random per-tab capability and requires both institution/user ownership columns to remain null.
- A user awaiting institutional approval receives no private course, evaluation, honor-management, invoice, or draft access.
- Never expose the service-role key or `DATABASE_URL` to Vite/browser code. The anon key is public and safe only with correct RLS.
- Do not alter provider-managed `auth` tables. Foreign keys to `auth.users` may be introduced only after Auth ownership and deployment contract are reviewed.

## Required decisions from Auth owner

1. Canonical institution primary key and institution status field/table.
2. Membership table or trusted claim/view/function, including approved/pending/rejected lifecycle.
3. Role source and the secure superadmin exception.
4. Public table/view/API contract for active institutions and published public content.
5. Course assignment/enrollment lookup contract usable in RLS without trusting browser filters.
6. Ownership and migration coordination for any shared profile/institution tables.

Until these are agreed, RLS on private domain tables must remain default-deny. No authorization migration should grant tenant writes based only on `institution_id` supplied by a client.

## Local implementation status

- The adapter accepts no caller-created identity and has no localStorage, URL, or form fallback.
- Unit tests use an explicitly simulated identity fixture to verify same-institution and approved-membership checks. These tests do not claim to validate Supabase JWT claims or PostgreSQL RLS.
- The server-side invoice repository is ready to receive a trusted context from the Auth owner and scopes every operation by institution and user. Until that contract arrives, the invoice UI stores demo invoices in Supabase using a random per-tab capability held in `sessionStorage`; RLS restricts each capability to its own invoice rows. This is temporary demo isolation, not institutional authorization. Replace it with verified Auth context at integration.
