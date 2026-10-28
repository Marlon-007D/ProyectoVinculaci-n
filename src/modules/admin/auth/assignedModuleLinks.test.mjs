import test from 'node:test';
import assert from 'node:assert/strict';
import { assignedModuleLinks } from './assignedModuleLinks.ts';

test('internal landing shows only granted modules with one coherent tenant pair in all four schools', () => {
  for (const slug of ['ue-la-concordia', 'ue-luz-de-america', 'ue-el-esfuerzo', 'ue-puerto-limon']) {
    const links = assignedModuleLinks({ institution_id: slug, slug, module_permissions: { projects: true, simuladores: true, dece: false } });
    assert.deepEqual(links.map(link => link.key), ['projects', 'simuladores']);
    for (const link of links) {
      const url = new URL(link.destination, 'https://school.test');
      assert.equal(url.searchParams.get('institution'), slug);
      assert.equal(url.searchParams.get('slug'), slug);
    }
  }
  assert.deepEqual(assignedModuleLinks({ institution_id: 'a', slug: 'a', module_permissions: {} }), []);
});
