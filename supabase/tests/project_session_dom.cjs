const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('typescript'),React=require('react');
const {JSDOM}=require(process.env.PROJECT_TEST_DOM || require('node:path').resolve('tmp/project-qa/node_modules/jsdom'));
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=require('react-dom/client'),router=require('react-router-dom');
const base='';
function load(path,imports={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(base+path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,window,document,sessionStorage:window.sessionStorage,require:n=>{
  if(n in imports)return imports[n];if(n==='react'||n==='react/jsx-runtime'||n==='lucide-react')return require(n);
  if(n.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>k})};throw Error(n);
 }});return exports;
}
const h=React.createElement;
let count=0,auth={user:{id:'one'}},tenantId='tenant-a',enabled=true,navigate;
const validation=load('src/modules/projects/projectValidation.ts');
const {ProjectFields,projectInput}=load('src/modules/projects/ProjectFields.tsx',{'./projectValidation':validation});
const {ProjectsDashboard}=load('src/modules/projects/ProjectsDashboard.tsx',{
 './projectService':{createProjectService:()=>({getProjects:async()=>{count++;return {data:[]}},getAcademicPeriod:async()=>null}),projectError:String},
 './projectValidation':validation,'./ProjectDetails':{ProjectDetails:()=>null},'./ProjectFields':{ProjectFields,projectInput},
 './projectPresentation':load('src/modules/projects/projectPresentation.ts',{'./projectValidation':validation}),
});
const institution=()=>({institution_id:tenantId,name:'School',role:'institution_admin'});
const {ProjectSessionHost}=load('src/modules/projects/integration/ProjectSessionHost.tsx',{
 'react-router-dom':router,'../../../core/AuthContext':{useAuth:()=>auth},
 '../../../core/TenantContext':{useTenant:()=>({activeInstitution:institution(),hasModuleAccess:()=>enabled})},
 './ModuleBoundary':{ModuleBoundary:({children})=>children},'../ProjectsWorkspace':{ProjectsWorkspace:()=>h(ProjectsDashboard,{institution:institution()})},
});
function Shell(){navigate=router.useNavigate();return h(ProjectSessionHost)}
const root=createRoot(document.getElementById('root'));
const render=()=>root.render(h(router.MemoryRouter,{initialEntries:['/panel/proyectos']},h(Shell)));
const settle=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 await React.act(async()=>{render();await settle()});await React.act(settle);
 assert.equal(count,1);
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Nuevo proyecto');
 await React.act(()=>button.click());
 const input=document.querySelector('input[name="name"]');assert.ok(input);input.value='Proyecto sin guardar';
 await React.act(async()=>{navigate('/panel/cursos');await settle()});
 assert.ok(input.closest('[style*="display: none"]'),'workspace must be hidden on other routes');
 await React.act(async()=>{navigate('/panel/proyectos');await settle()});
 assert.equal(document.querySelector('input[name="name"]'),input);
 assert.equal(input.value,'Proyecto sin guardar');assert.equal(count,1,'return must not refetch and reset');
 tenantId='tenant-b';await React.act(async()=>{render();await settle()});await React.act(settle);
 assert.equal(document.querySelector('input[name="name"]'),null,'another institution cannot inherit the draft');
 assert.equal(count,2);
 enabled=false;await React.act(async()=>{navigate('/panel/cursos');render();await settle()});
 assert.equal(document.querySelector('input'),null,'revoked workspace must be discarded');
 await React.act(()=>root.unmount());await checkAuthRefresh();console.log('PASS: navigation preserves the actual project form and avoids refetch; tenant changes and revoked access clear it.');
})().catch(e=>{console.error(e);process.exitCode=1});

async function checkAuthRefresh(){
 let callback,checks=0,members=true;const session={user:{id:'one'}};
 window.sessionStorage.setItem('auth-login-method','password');
 const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}}}},from:table=>{checks++;const result={data:table==='memberships'?(members?[{institution_id:'tenant-a',role_id:'admin'}]:[]):[{role_id:'admin',name:'institution_admin'}]};const query={select:()=>query,eq:()=>query,in:()=>query,then:resolve=>Promise.resolve(result).then(resolve)};return query;}};
 const {AuthProvider,useAuth}=load('src/core/AuthContext.tsx',{'./supabaseClient':{supabase:client},'./auth/registerInstitutionalAccount':{registerInstitutionalAccount(){}},'./auth/loginAccess':{institutionMatches:()=>false}});
 let states=[];function Probe(){const a=useAuth();states.push(a);return null}
 const node=document.createElement('div');document.body.appendChild(node);const authRoot=createRoot(node);
 await React.act(async()=>{authRoot.render(h(AuthProvider,null,h(Probe)));await settle()});await React.act(settle);
 assert.equal(states.at(-1).loading,false);const before=checks;
 for(const event of ['TOKEN_REFRESHED','SIGNED_IN']){
  states=[];await React.act(async()=>{callback(event,{...session,user:{id:'one'}});await settle()});await React.act(settle);
  assert.ok(states.every(s=>!s.loading),'same-account refresh must not remount workspaces');
 }
 assert.ok(checks>before,'refresh must still check permissions');
 members=false;await React.act(async()=>{callback('TOKEN_REFRESHED',session);await settle()});await React.act(settle);
 assert.ok(states.at(-1).roleError,'revoked membership must still be rejected');
 await React.act(async()=>{callback('SIGNED_OUT',null);await settle()});assert.equal(states.at(-1).user,null);
 await React.act(()=>authRoot.unmount());console.log('PASS: actual AuthProvider rechecks roles without blanking the same-user session, and detects revoked access/logout.');
}
