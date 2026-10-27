import test from 'node:test';
import assert from 'node:assert/strict';
import { expiredInvitationMessage, invitationLanding, parseInvitationLink } from './invitationLink.ts';
import { assignedTenants } from '../superadmin/mocks/assignedTenants.mjs';

test('expired email links are classified independently of Google on hash and query callbacks',()=>{
  const error='error=access_denied&error_code=otp_expired&error_description=Email+link+is_invalid_or_has_expired';
  assert.deepEqual(parseInvitationLink('',`#${error}`),{kind:'error',message:expiredInvitationMessage});
  assert.deepEqual(parseInvitationLink(`?${error}`,''),{kind:'error',message:expiredInvitationMessage});
  assert.deepEqual(parseInvitationLink('','#error=access_denied&error_description=OAuth+cancelled'),{kind:'none'});
});

test('invite, recovery and magic-link callbacks support access tokens, token hashes and an already established session',()=>{
  for(const type of ['invite','recovery','magiclink']){
    assert.deepEqual(parseInvitationLink('',`#type=${type}&access_token=test-access&refresh_token=test-refresh`),{kind:'tokens',accessToken:'test-access',refreshToken:'test-refresh',invitation:true});
    assert.deepEqual(parseInvitationLink(`?type=${type}&token_hash=test-hash`,''),{kind:'token-hash',tokenHash:'test-hash',type});
    assert.deepEqual(parseInvitationLink(`?type=${type}`,''),{kind:'session'});
  }
});

test('verified invitation or recovery callbacks can request the password screen without treating unrelated OAuth tokens as invitations',()=>{
  const plain=parseInvitationLink('','#access_token=test&refresh_token=refresh');
  assert.equal(plain.invitation,undefined);
  const url=new URL(invitationLanding('?institution=a&slug=school-a&code=secret',true),'http://localhost:5173');
  assert.equal(url.searchParams.get('accept_invitation'),'1');
  assert.equal(url.searchParams.get('code'),null);
});

test('all four institutions retain their callback scope on localhost and Render without carrying authentication secrets',()=>{
  for(const tenant of assignedTenants){
    const search='?'+new URLSearchParams({institution:tenant.institution_id,slug:tenant.slug,access_token:'sensitive',token_hash:'sensitive',error:'access_denied',error_code:'otp_expired'});
    for(const origin of ['http://localhost:5173','https://proyectovinculaci-n.onrender.com']){
      const url=new URL(invitationLanding(search),origin);
      assert.equal(url.origin,origin);assert.equal(url.pathname,'/panel/admin');
      assert.deepEqual([...url.searchParams.entries()],[['institution',tenant.institution_id],['slug',tenant.slug]]);
      assert.equal(url.hash,'');
    }
  }
});
