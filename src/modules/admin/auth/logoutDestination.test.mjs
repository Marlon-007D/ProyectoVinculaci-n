import test from 'node:test';
import assert from 'node:assert/strict';
import { logoutDestination, logoutToPublicInstitution, remoteSignOutTarget } from './logoutDestination.ts';

test('logout returns every school and role to its public root with a clean context', async () => {
  for (const slug of ['ue-luz-de-america','ue-puerto-limon','ue-la-concordia','ue-el-esfuerzo']) {
    for (const role of ['super_admin','institution_admin','dece','student','teacher','projects_manager','content_editor','secretary','staff']) {
      const calls = [];
      const destination = logoutDestination({ institution: role, slug }, role);
      await logoutToPublicInstitution(async () => { calls.push('signOut'); return { error: null }; }, destination,
        () => calls.push('cleanup'), target => calls.push(target));
      assert.deepEqual(calls, ['signOut','cleanup',`/?institution=${role}`]);
    }
  }
  assert.equal(logoutDestination({}, 'school'), '/?institution=school');
  assert.equal(logoutDestination({}, null), '/');
});

test('a rejected signOut never reports logout or navigates to the public page', async () => {
  const failure = new Error('Connection failed');
  await assert.rejects(logoutToPublicInstitution(async () => ({ error: failure }), '/',
    () => assert.fail('Must not clean an active session'), () => assert.fail('Must not redirect')), failure);
});

test('logout uses the current origin and only the verified institution on localhost and Render', () => {
  for (const origin of ['http://localhost:5173','https://proyectovinculaci-n.onrender.com']) {
    for (const id of ['school-a','school-b','school-c','school-d']) {
      const target = new URL(logoutDestination({ institution: 'stale', slug: 'ue-luz-de-america' }, id), origin);
      assert.equal(target.href, origin+'/?institution='+id);
      assert.deepEqual([...target.searchParams.keys()], ['institution']);
    }
  }
});

test('a tab whose session ended elsewhere goes to the public portal of its institution in one step', () => {
  const origin = 'https://demo.test';
  assert.equal(remoteSignOutTarget(origin, '/panel/admin', 'id-1'), 'https://demo.test/?institution=id-1');
  assert.equal(remoteSignOutTarget(origin, '/panel/publicaciones/noticias', 'ue luz'), 'https://demo.test/?institution=ue%20luz');
  assert.equal(remoteSignOutTarget(origin, '/ue-luz/dece', null), 'https://demo.test/');
});

test('public pages stay where they are when the session ends elsewhere', () => {
  for (const path of ['/', '/login', '/register', '/proyectos']) assert.equal(remoteSignOutTarget('https://demo.test', path, 'id-1'), null, path);
});
