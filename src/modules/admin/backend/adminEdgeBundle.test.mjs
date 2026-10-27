import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createAdminEdgeBundle } from './buildAdminEdgeBundle.mjs';

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
