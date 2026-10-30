import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { ADMIN_EDGE_BUNDLE_TARGETS, createAdminEdgeBundle } from './buildAdminEdgeBundle.mjs';

test('Dashboard deployment artifact has one entrypoint, no unresolved imports and routes delete via the existing function', async () => {
  const bundle=await createAdminEdgeBundle();
  assert(!/^import /m.test(bundle));
  assert.equal((bundle.match(/Deno\.serve\(/g)||[]).length,1);
  const {outputText,diagnostics}=ts.transpileModule(bundle,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  assert.equal(diagnostics.length,0);
  let handler;
  const Deno={serve:callback=>{handler=callback;},env:{get:()=>''}};
  new Function('Deno',outputText.replace(/^export /gm,''))(Deno);
  const response=await handler(new Request('https://function.example.test',{method:'POST',headers:{authorization:'Bearer caller-token'},body:JSON.stringify({action:'unsupported'})}));
  assert.equal(response.status,400);
});

test('the committed Edge Function entry point and Dashboard copy match the current handler', async () => {
  const bundle=(await createAdminEdgeBundle()).replace(/\r\n/g,'\n');
  for(const path of ADMIN_EDGE_BUNDLE_TARGETS){
    const committed=(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    assert.equal(committed,bundle,`${path} is stale: run node src/modules/admin/backend/buildAdminEdgeBundle.mjs`);
  }
});
