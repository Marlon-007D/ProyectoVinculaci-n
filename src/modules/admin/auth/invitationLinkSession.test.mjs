import test from 'node:test';
import assert from 'node:assert/strict';
import { captureInvitationSession } from './invitationLinkSession.ts';

test('an automatically established callback session is reused without consuming the link again',async()=>{
  await captureInvitationSession({kind:'tokens',accessToken:'access',refreshToken:'refresh'}, {
    getSession:async()=>({data:{session:{access_token:'access'}},error:null}),
    setSession:async()=>{throw new Error('Already handled by the SDK');},verifyOtp:async()=>{throw new Error('Must not verify twice');},
  });
});

test('a new callback restores its tokens and rejects incomplete sessions',async()=>{
  let restored;
  const auth={getSession:async()=>({data:{session:null},error:null}),setSession:async tokens=>{restored=tokens;return {error:null};}};
  await captureInvitationSession({kind:'tokens',accessToken:'new-access',refreshToken:'new-refresh'},auth);
  assert.deepEqual(restored,{access_token:'new-access',refresh_token:'new-refresh'});
  await assert.rejects(captureInvitationSession({kind:'tokens',accessToken:'new-access',refreshToken:''},auth),/completa/);
  await assert.rejects(captureInvitationSession({kind:'session'},auth),/válida/);
});

test('expired token hashes preserve the Auth error and cancelled callbacks cannot establish another session',async()=>{
  const expired={code:'otp_expired',message:'Expired'};
  const auth={getSession:async()=>({data:{session:null},error:null}),verifyOtp:async()=>({error:expired}),setSession:async()=>{throw new Error('Unexpected session change');}};
  await assert.rejects(captureInvitationSession({kind:'token-hash',tokenHash:'hash',type:'invite'},auth),error=>error===expired);
  await captureInvitationSession({kind:'tokens',accessToken:'access',refreshToken:'refresh'},auth,()=>false);
});
