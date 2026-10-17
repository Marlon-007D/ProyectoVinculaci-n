import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DenyByDefaultAuthorization, isApprovedTenantSession } from '../../src/core/auth/authorization.ts'

const approvedIdentityFixture = Object.freeze({
  userId: 'simulated-user-001',
  institutionId: '11111111-1111-4111-8111-111111111111',
  role: 'teacher',
  membershipStatus: 'approved',
})

test('the provisional Auth adapter denies access without a verified provider', async () => {
  const authorization = new DenyByDefaultAuthorization()
  assert.equal(await authorization.getVerifiedSession(), null)
  assert.equal(await authorization.canAccessInstitution(approvedIdentityFixture.institutionId), false)
})

test('tenant access requires an approved identity for the same institution', () => {
  assert.equal(isApprovedTenantSession(approvedIdentityFixture, approvedIdentityFixture.institutionId), true)
  assert.equal(isApprovedTenantSession(approvedIdentityFixture, '22222222-2222-4222-8222-222222222222'), false)
  assert.equal(isApprovedTenantSession({ ...approvedIdentityFixture, membershipStatus: 'pending' }, approvedIdentityFixture.institutionId), false)
  assert.equal(isApprovedTenantSession(null, approvedIdentityFixture.institutionId), false)
})

test('the active hardening migration creates no permissive policy', async () => {
  const migration = await readFile(new URL('../../drizzle/0001_enforce_invoice_catalog_security.sql', import.meta.url), 'utf8')
  assert.match(migration, /force row level security/i)
  assert.match(migration, /revoke all on table "invoice_products" from public, anon, authenticated/i)
  assert.doesNotMatch(migration, /create policy/i)
})
