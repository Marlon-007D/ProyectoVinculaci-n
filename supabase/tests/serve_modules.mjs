import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const workspace=fileURLToPath(new URL('../../',import.meta.url));
const prepared=spawnSync(process.platform==='win32'?'py':'python3',['supabase/tests/verify_modules.py','--prepare-only'],{cwd:workspace,stdio:'inherit',windowsHide:true});
if(prepared.status!==0)process.exit(prepared.status??1);
const server=await createServer({
  root:resolve(workspace,'tmp/verify-modules'),envDir:workspace,
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  plugins:[{name:'institutional-module-preview',transformIndexHtml(html){
    return html.replace('/src/main.tsx','/src/modules/projects/dev/main.tsx').replace(/<title>.*?<\/title>/,'<title>Gestión institucional</title>');
  }}],
});
await server.listen();server.printUrls();
