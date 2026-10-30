const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,imports={}){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,URL,URLSearchParams,structuredClone,crypto:require('node:crypto').webcrypto,require:name=>{if(name in imports)return imports[name];if(name==='../site/utils/institutionalNavigation')return load('src/modules/site/utils/institutionalNavigation.ts');if(name==='../site/utils/menuTree')return load('src/modules/site/utils/menuTree.ts');if(name==='../site/utils/siteConfig')return load('src/modules/site/utils/siteConfig.ts');if(name==='./portalMenus')return load('src/modules/portal-editor/portalMenus.ts');if(['./projectStyles','./portalStyles'].includes(name))return {moduleClass:value=>value};if(['react','lucide-react'].includes(name))return require(name);throw new Error('Unexpected import '+name);}});return exports;
}
function client(responses){
 const calls=[];
 const fake={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from(table){const call={table,action:'read',filters:[]};let done=false;
 const execute=()=>{if(done)throw new Error('Query executed twice');done=true;calls.push(call);assert.ok(responses.length,'Unexpected query: '+JSON.stringify(call));return Promise.resolve(responses.shift());};
 const query={select(columns){call.columns=columns;return query;},insert(payload){call.action='insert';call.payload=payload;return query;},update(payload){call.action='update';call.payload=payload;return query;},delete(){call.action='delete';return query;},upsert(payload){call.action='upsert';call.payload=payload;return query;},eq(key,value){call.filters.push(['eq',key,value]);return query;},in(key,value){call.filters.push(['in',key,value]);return query;},or(value){call.filters.push(['or',value]);return query;},neq(key,value){call.filters.push(['neq',key,value]);return query;},range(from,to){call.range=[from,to];return query;},order(){return query;},limit(){return query;},single:execute,maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject);}};return query;},rpc:async(name,args)=>{if(name==='project_read')return {data:null,error:{code:'PGRST202'}};calls.push({action:'rpc',name,...args});assert.ok(responses.length,'Unexpected RPC '+name);return responses.shift();}};
 return {fake,calls};
}
const money=load('src/modules/projects/projectValidation.ts');
const contract=load('src/modules/portal-editor/contract.ts');
test('rutas de integración conservan portada, cursos y navegación existente',()=>{
 const react=require('react');const router=require('react-router-dom');const jsx=require('react/jsx-runtime');
 const marker=text=>()=>react.createElement('p',null,text);
 const {SiteApp}=load('src/modules/site/SiteApp.tsx',{
  'react-router-dom':router,'react/jsx-runtime':jsx,'./context/InstitutionContext':{InstitutionProvider:({children})=>children},
  './components/Layout/EmbeddedLayout':{EmbeddedLayout:router.Outlet},'./components/Layout/SiteLayout':{SiteLayout:router.Outlet},
  './pages/NotFound':{NotFound:marker('EXISTING_NOT_FOUND')},'./pages/SitePreview':{SitePreview:marker('EXISTING_HOME')},
  '../../features/feats/pages/FeatsLoginPage':{FeatsLoginPage:marker('EXISTING_COURSES')},'../../features/feats/services/featsAuth':{localDemoAuthService:{}},'./styles/site.css':{},
 });
 let authState={user:null},tenantState={activeInstitution:null};
 function renderApp(path){
  const {default:App}=load('src/App.tsx',{'react':{...react,lazy:()=>marker('NEW_MODULE')},'react/jsx-runtime':jsx,
   'react-router-dom':{...router,BrowserRouter:({children})=>react.createElement(router.MemoryRouter,{initialEntries:[path]},children)},

   './core/AuthContext':{AuthProvider:({children})=>children,useAuth:()=>authState},'./modules/admin/auth/returnTo':{returnToFromLocation:()=>null},
   './core/TenantContext':{TenantProvider:({children})=>children,useTenant:()=>tenantState},
   './modules/site/components/Layout/InstitutionSessionLayout':{InstitutionSessionLayout:({children})=>children},
   './modules/site/components/Layout/PrivateWorkspace':{PrivateWorkspace:({children})=>children},'./modules/site/components/Layout/PrivateContentSkeleton':{PrivateContentSkeleton:marker('PRIVATE_SKELETON')},
   './modules/site/components/Header/InstitutionalHeader':{InstitutionalHeader:marker('SHARED HEADER')},
   './pages/InstitutionalPanel':{InstitutionalPanel:marker('PANEL')},
   './modules/dece':{DeceApp:marker('DECE'),DeceDataProvider:({children})=>children},
   './core/supabaseClient':{supabase:{}},
   './features/feats/pages/AcademicManagementRoutes':{AcademicManagementRoutes:marker('ACADEMIC')},
   './modules/site/context/InstitutionContext':{InstitutionProvider:({children})=>children,useInstitution:()=>({institutionId:'tenant-a'})},
   './modules/dece/public':{DecePublicSection:marker('DECE')},
   './core/auth/session':{SessionProvider:marker('SESSION')},
   './modules/admin/AdminRoutes':{default:marker('ADMIN')},
   './modules/auth/RegistrationRoute':{RegistrationRoute:marker('REGISTER')},
   './modules/auth/LoginRoute':{LoginRoute:marker('LOGIN')},
   './features/auth/pages/AuthPage':{AuthPage:marker('LOGIN')},
   './modules/admin/userManagement/membershipRequestService':{membershipRequestService:{}},
   './app/App':{__esModule:true,default:marker('SIMULATORS')},
   './modules/site':{SiteApp},'./modules/projects/integration/ModuleBoundary':{ModuleBoundary:({children})=>children},
   './modules/projects/integration/ProjectSessionHost':{ProjectSessionHost:()=>null,isPrivateProjectsPath:()=>false},
   './shared/components/ConfirmDialog/ConfirmHost':{ConfirmHost:()=>null},'./shared/components/Toaster/AppToaster':{AppToaster:()=>null},
   './shared/components/ErrorPage/ErrorBoundary':{ErrorBoundary:({children})=>children},
   './shared/components/ErrorPage/ErrorPage':{ErrorPage:marker('ERROR_PAGE')},
  });
  return require('react-dom/server').renderToStaticMarkup(react.createElement(App));
 }
 for(const [path,expected] of [['/','EXISTING_HOME'],['/admin-cursos','EXISTING_COURSES'],['/unknown','EXISTING_NOT_FOUND'],['/panel/proyectos','NEW_MODULE'],['/panel/portal','NEW_MODULE'],['/proyectos?transparency=1','NEW_MODULE'],['/portal?institution=school','NEW_MODULE'],['/panel/ruta-inexistente','ERROR_PAGE'],['/panel/cursos','ACADEMIC'],['/panel/simuladores','SIMULATORS']]){
  assert.ok(renderApp(path).includes(expected),path+' did not preserve its route');
 }
 // Reloading a private page: children redirect from `user`, which is null until the session resolves.
 for(const path of ['/panel/publicaciones/cuadro-de-honor','/panel/cursos/categorias','/panel/dece','/panel/admin']){
  authState={user:null,loading:true};tenantState={activeInstitution:null,loadingTenant:true};
  const loading=renderApp(path);
  assert.equal(loading.split('PRIVATE_SKELETON').length-1,1,path+' must show exactly one private skeleton while the session loads');
  for(const page of ['ACADEMIC','ADMIN','DECE'])assert.ok(!loading.includes(page),path+' rendered '+page+' before the session resolved');
 }
 authState={user:{id:'u1'},loading:false};tenantState={activeInstitution:null,loadingTenant:false};
 const ready=renderApp('/panel/publicaciones/cuadro-de-honor');
 assert.ok(ready.includes('ACADEMIC')&&!ready.includes('PRIVATE_SKELETON'),'the page replaces the skeleton once the session resolves');
 authState={user:{id:'u1'},loading:false};tenantState={activeInstitution:null,loadingTenant:true};
 assert.ok(renderApp('/panel/admin').includes('PRIVATE_SKELETON'),'a signed-in user waits for the tenant before the page mounts');
 authState={user:null};tenantState={activeInstitution:null};
});

const presentation=load('src/modules/projects/projectPresentation.ts',{'./projectValidation':money});
test('búsqueda de proyectos combina acentos, estado y visibilidad sin alterar el origen',()=>{
 const rows=[{name:'Educación ambiental',description:'Huerto',active:true,budget:150,spent:25,public:true},{name:'Educacion vial',description:'Seguridad',active:false,budget:300,spent:50,public:true},{name:'Huerto privado',description:'Educación',active:true,budget:50,spent:0,public:false}];
 const original=JSON.stringify(rows);
 const result=presentation.filterProjectList(rows,p=>p,{query:' EDUCACION ',status:'active',publication:'public',sort:'name'});
 assert.equal(result.length,1);assert.equal(result[0].name,'Educación ambiental');assert.equal(JSON.stringify(rows),original);
 assert.equal(presentation.filterProjectList(rows,p=>p,{query:'inexistente',status:'all',publication:'all',sort:'name'}).length,0);
});
test('orden financiero compara números, conserva presupuesto cero y no modifica las filas',()=>{
 const rows=[{name:'B',description:'',active:true,budget:9,spent:5,public:true},{name:'A',description:'',active:true,budget:100,spent:9,public:true},{name:'C',description:'',active:false,budget:0,spent:0,public:true}];
 const filters={query:'',status:'all',publication:'all',sort:'budget'};
 assert.equal(presentation.filterProjectList(rows,p=>p,filters).map(p=>p.name).join(','),'A,B,C');
 assert.equal(presentation.filterProjectList(rows,p=>p,{...filters,sort:'spent'}).map(p=>p.name).join(','),'A,B,C');
 assert.equal(presentation.filterProjectList(rows,p=>p,{...filters,status:'closed'}).map(p=>p.name).join(','),'C');
 assert.equal(rows.map(p=>p.name).join(','),'B,A,C');
});
test('fechas de proyecto se muestran sin retroceder un día por la zona horaria',()=>{
 const date=presentation.formatProjectDate('2026-10-01');assert.match(date,/1/);assert.match(date,/oct/);assert.ok(!date.includes('sept'));
 assert.equal(presentation.formatProjectDate('2026-02-30'),'Sin fecha definida');assert.equal(presentation.formatProjectDate(''),'Sin fecha definida');
});
test('indicadores financieros distinguen falta de datos, presupuesto cero y gasto registrado',()=>{
 const visuals=load('src/modules/projects/ProjectVisuals.tsx',{'./projectValidation':money,'./projectPresentation':presentation,'react/jsx-runtime':require('react/jsx-runtime')});
 const render=(Component,props)=>require('react-dom/server').renderToStaticMarkup(require('react').createElement(Component,props));
 const empty=render(visuals.FinancialProgress,{budget:0,spent:0});assert.ok(empty.includes('Sin presupuesto'));assert.ok(!empty.includes('<progress'));assert.ok(!empty.includes('NaN'));
 const used=render(visuals.FinancialProgress,{budget:1000,spent:150.25});assert.ok(used.includes('value="15.03"'));assert.ok(used.includes('no el avance de las actividades'));
 const loading=render(visuals.ProjectMetrics,{count:0,budget:0,spent:0,available:false});assert.ok(loading.includes('Información pendiente'));assert.ok(!loading.includes('$'));
});
test('transparencia renderiza solo el resumen público y no presenta totales durante la carga',()=>{
 const jsx=require('react/jsx-runtime');const react=require('react');
 const transparency=load('src/modules/projects/publicTransparency.ts',{'./projectPresentation':presentation,'./projectValidation':money});
 // The adapter keeps only public summary fields, whatever else the server sends.
 const raw={project_id:'p-a',title:'Huerto público',description:'Objetivo aprobado',is_active:true,total_budget:'1000',spent:'250',balance:'750',participants:'PERSONA PRIVADA',receipt:'COMPROBANTE PRIVADO'};
 function render(pending){
  const page={total:1,rows:[{...raw,total_budget:1000,spent:250,balance:750}],summary:{count:1,budget:1000,spent:250,active:1,closed:0}};
  const key=JSON.stringify(['escuela','','all','name',1,9,0]);
  // useState order: slug, institutions, draft, search, status, sort, page, pageSize, view, revision, load.
  const values=['escuela',{status:'ready',rows:[{name:'Escuela de prueba',slug:'escuela'}]},'','','all','name',1,9,'cards',0,pending?null:{key,state:{status:'ready',data:page,checkedAt:'20 oct 2026'}}];let i=0;
  const {PublicProjects}=load('src/modules/projects/PublicProjects.tsx',{'react':{...react,useEffect:()=>{},useState:()=>[values[i++],()=>{}]},'../../core/supabase/publicClient':{publicSupabase:{}},'../../shared/components/Toaster/NotifyBridge':{NotifyBridge:()=>null},'./projectValidation':money,'./projectPresentation':presentation,'./publicTransparency':transparency,'./TransparencyReportActions':{TransparencyReportActions:()=>null},'./PublicProjects.module.css':{default:{}},'react/jsx-runtime':jsx,'../../shared/components/Toaster/notify':{notify:{}}});
  return require('react-dom/server').renderToStaticMarkup(react.createElement(PublicProjects));
 }
 const html=render(false);assert.ok(html.includes('Huerto público'));assert.ok(html.includes('Escuela de prueba'));assert.ok(html.includes('Mostrando 1–1 de 1 proyectos'));
 const pending=render(true);assert.ok(pending.includes('Consultando información pública'));assert.ok(!pending.includes('$1000'));assert.ok(!pending.includes('Huerto público'));
});
test('transparencia pagina en el servidor y, sin el SQL nuevo, usa temporalmente el resumen anterior',async()=>{
 const transparency=load('src/modules/projects/publicTransparency.ts',{'./projectPresentation':presentation,'./projectValidation':money});
 assert.equal(JSON.stringify(transparency.pageWindow(1,1)),'[1]');
 assert.equal(JSON.stringify(transparency.pageWindow(5,10)),'[1,"gap",4,5,6,"gap",10]');
 assert.equal(JSON.stringify(transparency.pageWindow(2,3)),'[1,2,3]');
 const calls=[];const rows=n=>Array.from({length:n},(_,i)=>({project_id:'p'+i,title:'Proyecto '+i,description:'',is_active:i%2===0,total_budget:100,spent:i,balance:100-i,participants:'PRIVADO'}));
 const paged=transparency.createTransparencySource({rpc:async(name,args)=>{calls.push(name);return {data:{total:30,rows:rows(9),summary:{count:30,budget:3000,spent:120,active:15,closed:15}},error:null};}});
 const result=await paged.page({slug:'a',search:'',status:'all',sort:'name',page:2,pageSize:9});
 assert.equal(JSON.stringify(calls),'["project_public_page"]');assert.equal(result.rows.length,9);assert.equal(result.total,30);
 assert.ok(!JSON.stringify(result).includes('PRIVADO'));
 calls.length=0;
 const legacy=transparency.createTransparencySource({rpc:async name=>{calls.push(name);return name==='project_public_page'?{data:null,error:{code:'PGRST202'}}:{data:rows(20),error:null};}});
 const second=await legacy.page({slug:'a',search:'',status:'active',sort:'name',page:2,pageSize:4});
 assert.equal(JSON.stringify(calls),'["project_public_page","project_public_summary"]');
 assert.equal(second.total,10);assert.equal(second.rows.length,4);assert.equal(second.summary.count,20);assert.equal(second.summary.active,10);
 // The missing paginated function is remembered: later pages skip the request that returns 404.
 calls.length=0;await legacy.page({slug:'a',search:'',status:'all',sort:'name',page:1,pageSize:4});
 assert.equal(JSON.stringify(calls),'["project_public_summary"]');
 const broken=transparency.createTransparencySource({rpc:async()=>({data:null,error:{code:'42501'}})});
 await assert.rejects(broken.page({slug:'a',search:'',status:'all',sort:'name',page:1,pageSize:9}));
});
test('informe público de transparencia: reúne todas las páginas y solo exporta campos publicados',async()=>{
 const transparency=load('src/modules/projects/publicTransparency.ts',{'./projectPresentation':presentation,'./projectValidation':money});
 const all=Array.from({length:120},(_,i)=>({project_id:'p'+i,title:i===0?'=SUMA(A1)':'Proyecto '+i,description:'Objetivo',is_active:i%2===0,total_budget:100,spent:25,balance:75}));
 const sizes=[];const source={institutions:async()=>[],page:async q=>{sizes.push(q.pageSize);const start=(q.page-1)*q.pageSize;return {total:all.length,rows:all.slice(start,start+q.pageSize).map(r=>({...r,participants:'PRIVADO'})),summary:{count:120,budget:0,spent:0,active:0,closed:0}};}};
 const rows=await transparency.collectRows(source,{slug:'a',search:'',status:'all',sort:'name'});
 assert.equal(rows.length,120);assert.equal(JSON.stringify(sizes),'[50,50,50]');
 const [summary,projects]=transparency.transparencyXlsxSheets('Escuela',rows,'20 oct 2026','2026-10-20');
 assert.equal(projects.rows.length,122);assert.equal(projects.rows[1][3],'En ejecución');assert.equal(projects.rows[1][4].value,100);
 assert.equal(projects.rows[121][0].value,'Totales');assert.equal(projects.rows[121][4].value,12000);assert.equal(summary.rows[5][1],120);
 // A title that looks like a formula stays plain text in the workbook; private fields never reach it.
 assert.equal(projects.rows[1][0],'=SUMA(A1)');assert.ok(!JSON.stringify([summary,projects]).includes('PRIVADO'));
});
const images=load('src/modules/portal-editor/assetValidation.ts');
test('imágenes públicas: valida firma, tamaño y tipo antes de subir',()=>{
 assert.equal(images.validateImageHeader('image/png',100,new Uint8Array([137,80,78,71,13,10,26,10])),'png');
 assert.equal(images.validateImageHeader('image/jpeg',100,new Uint8Array([255,216,255])),'jpg');
 assert.equal(images.validateImageHeader('image/webp',100,Buffer.from('RIFF1234WEBP')),'webp');
 for(const [type,size,bytes] of [
  ['image/svg+xml',100,Buffer.from('<svg>')],['image/png',100,Buffer.from('<script>')],
  ['image/png',0,new Uint8Array()],['image/png',images.MAX_PORTAL_IMAGE_BYTES+1,new Uint8Array()],
  ['image/jpeg',100,new Uint8Array([137,80,78,71,13,10,26,10])],
 ])assert.throws(()=>images.validateImageHeader(type,size,bytes));
});

function sharedPortalRenderer(){
 const react=require('react'),jsx=require('react/jsx-runtime');const h=react.createElement;
 const noop=()=>null;
 const {PageSections}=load('src/modules/site/components/Page/PageSections.tsx',{
  'react/jsx-runtime':jsx,'react-router-dom':{useLocation:()=>({search:''}),Link:({to,children,...rest})=>h('a',{href:to,...rest},children)},
  '../../context/InstitutionContext':{useInstitution:()=>({institution:{slug:'test',name:'Test'}})},
  '../../hooks/useSite':{useSite:()=>({config:{social:[]}})},
  '../../utils/snapshot':load('src/modules/site/utils/snapshot.ts'),
  '../../utils/url':load('src/modules/site/utils/url.ts'),
  '../../mocks/publicPageSamples':load('src/modules/site/mocks/publicPageSamples.ts'),
  '../Content/ContentSections':{EventsSection:noop,HonorsSection:noop,NewsSection:noop,StaffSection:noop},
  '../External/ExternalSection':{EXTERNAL_SECTION_TYPES:['transparency','simulators'],ExternalSection:({title})=>h('p',null,title)},
  '../Gallery/GallerySection':{GallerySection:noop,galleryItems:()=>[]},
  '../../styles/sections.css':{},'./PageSections.module.css':{__esModule:true,default:{cards:'cards',editorial:'editorial'}},
 });
 const {SiteFrame}=load('src/modules/site/components/Layout/SiteFrame.tsx',{
  'react/jsx-runtime':jsx,'react-router-dom':{useSearchParams:()=>[new URLSearchParams()]},'../../styles/layout.css':{},'../../styles/module-integrations.css':{},
  '../Header/Header':{Header:({config,menu,homeUrl})=>h('header',null,h('a',{href:homeUrl},config.name),h('img',{src:config.logoUrl,alt:'Logotipo de '+config.name}),...menu.state.data.map(item=>h('a',{key:item.menu_id,href:item.url},item.label)))},
  '../Footer/Footer':{Footer:({config})=>h('footer',null,config.footerText)},
  '../Navigation/PublicSidebar':{PublicSidebar:noop},
 });
 return load('src/modules/portal-editor/PortalRenderer.tsx',{
  'react/jsx-runtime':jsx,'./contract':contract,
  '../site/context/InstitutionContext':{InstitutionProvider:({children})=>children},
  '../site/components/Layout/SiteFrame':{SiteFrame},'../site/components/Page/PageSections':{PageSections},
  '../site/utils/theme':load('src/modules/site/utils/theme.ts'),'../site/styles/site.css':{},
 });
}

test('portal: logo accesible, navegación pública y vista previa sin enlaces activos',()=>{
 const snapshot=contract.newSnapshot('Colegio de prueba');snapshot.title='Inicio';snapshot.settings.logo_url='https://example.test/logo.png';snapshot.menus=[{label:'Contacto',url:'/contacto'}];
 snapshot.sections=[{id:'links',type:'links',is_visible:true,position:0,properties:{url:'/documento',link_label:'Documento'}}];
 const normalized=contract.normalizeSnapshot(snapshot);
 const {PortalRenderer}=sharedPortalRenderer();
 const render=preview=>require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot:normalized,institutionSlug:'escuela',preview}));
 const html=render(false);assert.ok(html.includes('alt="Logotipo de Colegio de prueba"'));assert.ok(html.includes('href="/contacto"'));
 assert.equal((html.match(/href="\/documento"/g)||[]).length,1);
 const preview=render(true);assert.ok(preview.includes('inert=""'));assert.ok(preview.includes('site-root'));assert.ok(html.includes('site-root'));
});
function snapshotFixture(name){return {...contract.newSnapshot(name),title:'Inicio',slug:'inicio',is_homepage:true,sections:[{id:'banner-fixture',type:'banner',position:0,is_visible:true,properties:{title:name}}]};}
test('editor y portal comparten plantillas, galería y contenido visible',()=>{
 const snapshot=snapshotFixture('Escuela');snapshot.template='editorial';
 snapshot.sections.push({id:'photo',type:'gallery',is_visible:true,position:1,properties:{image_url:'https://example.test/escuela.png',alt:'Patio escolar',body:'Actividad institucional'}});
 const {PortalRenderer}=sharedPortalRenderer();
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot,institutionSlug:'escuela',preview:true}));
 assert.match(html,/class="editorial"/);assert.match(html,/alt="Patio escolar"/);assert.match(html,/Actividad institucional/);assert.match(html,/site-gallery/);
});
test('el portal público filtra borradores incluso si hay sesión administrativa en el navegador',async()=>{
 const calls=[];const query={select(){return query},eq(){return query},or(value){calls.push(value);return query},order(){return query},limit(){return query},maybeSingle:async()=>({data:null,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
 const versions=load('src/modules/site/services/versions.ts',{
  '../lib/demo':{isDemoMode:()=>false},'../lib/supabase':{getSupabase:()=>{throw new Error('Private client used by public page')}},
  '../../../core/supabase/publicClient':{publicSupabase:{from:()=>query}},'../lib/errors':{toServiceError:()=>new Error('query failed')},
 });
 await versions.getLastVersion('page-a');await versions.getVersion('page-a',1);await versions.getVersions('page-a');
 assert.equal(calls.length,3);assert.ok(calls.every(value=>value==='content_snapshot->>publication_state.is.null,content_snapshot->>publication_state.eq.published'));
});
const row={revision:1,project_id:'p-a',institution_id:'tenant-a',title:'Huerto',description:'Objetivo',total_budget:'1000.00',is_public:false,start_date:'2026-10-01',end_date:'2026-11-30',budget_items:[{budget_item_id:'b-a',project_id:'p-a',name:'Materiales',allocated_amount:'600',expenses:[{expense_id:'e-a',budget_item_id:'b-a',amount:'150.25',description:'Semillas',expense_date:'2026-10-16'}]}],project_members:[]};
function service(responses,revision){const c=client(responses);return {...c,service:load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:c.fake},'./projectValidation':money}).createProjectService('tenant-a',()=> '2026-10-15',revision)};}
const ok=data=>({data,error:null});
const period={academic_period_id:'period-a',name:'Costa 2026-2027',start_date:'2026-05-04',end_date:'2027-03-11'};
function portal(responses){const c=client(responses);const originalRpc=c.fake.rpc;c.fake.rpc=(name,args)=>name==='portal_editor_content_version'?Promise.resolve(ok(2)):name==='portal_editor_retention_version'?Promise.resolve(ok(1)):originalRpc(name,args);const module=load('src/modules/portal-editor/portalService.ts',{'../../core/supabaseClient':{supabase:c.fake},'../projects/integration/accessService':{getUserInstitutions:async()=>[{institution_id:'tenant-a',role:'institution_admin',enabled_modules:['portal']}]},'./contract':contract,'../site/utils/snapshot':load('src/modules/site/utils/snapshot.ts')});return {...c,module};}

test('crear proyecto envía institución, fechas e importe a la operación atómica',async()=>{
 const {service:s,calls}=service([ok([period]),ok(row)]);
 await s.createProject({name:' Huerto ',description:'Objetivo',budget_total:250000,start_date:'2026-10-15',end_date:'2026-11-01'});
 assert.equal(calls[1].name,'project_operation');assert.equal(calls[1].target_institution,'tenant-a');
 assert.equal(calls[1].operation,'create_project');assert.equal(calls[1].payload.budget_total,250000);assert.equal(calls[1].payload.name,'Huerto');
 assert.ok(calls.every(c=>c.action==='read'||c.action==='rpc'));
});
test('gasto conserva la validación local y delega el saldo final al servidor',async()=>{
 const {service:s,calls}=service([ok(row),ok({expense_id:'new',budget_item_id:'b-a',amount:'25.20',description:'Compra',expense_date:'2026-10-16'})]);
 const saved=await s.addExpense('b-a','p-a',25.2,'Compra','2026-10-15');
 assert.equal(saved.amount,25.2);assert.equal(calls[1].operation,'add_expense');assert.equal(calls[1].payload.project_id,'p-a');assert.equal(calls[1].payload.budget_item_id,'b-a');
 assert.ok(!('created_by' in calls[1].payload));
});
test('rechazo concurrente del servidor no se presenta como gasto guardado',async()=>{
 const failure={code:'P0001',message:'El gasto supera el saldo del rubro. Actualiza los datos.'};
 const {service:s}=service([ok(row),{data:null,error:failure}]);await assert.rejects(()=>s.addExpense('b-a','p-a',25,'Compra','2026-10-15'),e=>e===failure);
});
test('editar rubro valida ejecución y envía importe al servidor en una sola operación',async()=>{
 const {service:s,calls}=service([ok(row),ok({})]);await s.updateBudgetItem('p-a','b-a','Material actualizado',700);
 assert.equal(calls[1].operation,'update_budget');assert.equal(calls[1].payload.amount,700);
});
test('participante usa perfil institucional y responsabilidad sin ampliar permisos',async()=>{
 const {service:s,calls}=service([ok(row),ok([{profile_id:'profile-a',full_name:'Persona',email:'persona@example.test'}]),ok({})]);
 await s.addProjectMember('p-a',{profile_id:'profile-a',role:' Responsable '});
 assert.equal(calls[1].name,'project_member_options');assert.equal(calls[2].operation,'add_member');assert.equal(calls[2].payload.role,'Responsable');
});
test('eliminar gasto incluye sus tres niveles de pertenencia',async()=>{
 const {service:s,calls}=service([ok(row),ok({})]);await s.deleteExpense('b-a','p-a','e-a');
 assert.equal(calls[1].target_institution,'tenant-a');assert.equal(calls[1].payload.project_id,'p-a');assert.equal(calls[1].payload.budget_item_id,'b-a');assert.equal(calls[1].payload.expense_id,'e-a');
});
test('publicación y estado se confirman mediante el servidor',async()=>{
 const {service:s,calls}=service([ok(row),ok({...row,is_public:true}),ok({})]);
 assert.equal(await s.setPublication('p-a',true),true);await s.setStatus('p-a',false);
 assert.equal(calls[1].operation,'publish');assert.equal(calls[2].operation,'set_status');assert.equal(calls[2].payload.active,false);
});
test('guardar borrador no escribe en versiones o tablas públicas desde el navegador',async()=>{
 const snapshot=snapshotFixture('Institución');const p=portal([ok({page_id:'page-a',revision:3,status:'published',snapshot})]);
 const saved=await p.module.savePortal('tenant-a','page-a',2,snapshot,false);
 assert.equal(saved.revision,3);assert.equal(p.calls.length,1);assert.equal(p.calls[0].name,'portal_editor_save');assert.equal(p.calls[0].publish,false);assert.equal(p.calls[0].expected_revision,2);
});
test('publicación atómica conserva el contrato consumido por el portal',async()=>{
 const snapshot=snapshotFixture('Institución');const p=portal([ok({page_id:'page-a',revision:1,status:'published',snapshot})]);
 await p.module.savePortal('tenant-a',null,0,snapshot,true);
 assert.equal(p.calls.length,1);assert.equal(p.calls[0].publish,true);assert.equal(p.calls[0].snapshot.schema_version,1);assert.equal(p.calls[0].target_institution,'tenant-a');
});

test('publishing an older page draft cannot replace the shared institutional header',async()=>{
 const snapshot=snapshotFixture('Institución');snapshot.menus=[{label:'Menú antiguo',url:'/old'}];
 const p=portal([ok({page_id:'page-a',revision:2,status:'published',snapshot})]);
 await p.module.savePortal('tenant-a','page-a',1,snapshot,true);
 const menus=p.calls[0].snapshot.menus;
 assert.ok(!menus.some(menu=>menu.label==='Menú antiguo'));
 const institution=menus.find(menu=>menu.label==='Institución');
 assert.equal(menus.find(menu=>menu.label==='Nosotros').parent_id,institution.id);
 assert.equal(menus.find(menu=>menu.label==='Oferta educativa').parent_id,institution.id);
});
test('conflicto de revisión y error de publicación se propagan sin éxito simulado',async()=>{
 for(const failure of [{code:'40001',message:'Versión más reciente'},{code:'42501',message:'Sin permiso'}]){
  const p=portal([{data:null,error:failure}]);await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',1,snapshotFixture('Colegio'),true),e=>e===failure);assert.equal(p.calls.length,1);
 }
});
test('menús demasiado largos y logotipo inseguro se rechazan antes de guardar',async()=>{
 for(const snapshot of [{...snapshotFixture('Colegio'),menus:[{label:'x'.repeat(101),url:'/'}]}, {...snapshotFixture('Colegio'),settings:{site_title:'Colegio',logo_url:'https://host/\\evil',footer_text:''}}]){
  const p=portal([]);await assert.rejects(()=>p.module.savePortal('tenant-a',null,0,snapshot,true));assert.equal(p.calls.length,0);
 }
 assert.equal(contract.safeUrl('/'),'/');
});
test('el contrato conserva el contenido para los dos renderizadores sin perder propiedades',()=>{
 const snapshot=snapshotFixture('Colegio');snapshot.sections[0].properties={body:'Bienvenida',url:'/contacto',link_label:'Contacto',size:'compact'};
 const normalized=contract.normalizeSnapshot(snapshot);
 assert.equal(normalized.sections[0].properties.subtitle,'Bienvenida');assert.equal(normalized.sections[0].properties.button_url,'/contacto');assert.equal(normalized.sections[0].properties.size,'compact');assert.ok(!('subtitle' in snapshot.sections[0].properties));
});
test('centavos y conversión de filas del esquema real',()=>{
 assert.equal(money.sumMoney([.1,.2]),.3);assert.equal(money.remainingMoney(1000,150.25),849.75);
 for(const n of [NaN,Infinity,-1,.001])assert.equal(money.isMoney(n),false);
 const module=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:{}},'./projectValidation':money});const project=module.mapProject(row);
 assert.equal(project.budget_items[0].spent_amount,150.25);assert.equal(project.budget_total,1000);
});
test('lista vacía no recupera datos locales y filtra la institución',async()=>{
 const {service:s,calls}=service([ok([])]);assert.equal((await s.getProjects()).data.length,0);assert.deepEqual(calls[0].filters,[['eq','institution_id','tenant-a']]);
});
test('fechas invertidas e importes inválidos no llegan al servidor',async()=>{
 const {service:s,calls}=service([]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:10,start_date:'2026-11-01',end_date:'2026-10-01'}),/fecha final/);
 await assert.rejects(()=>s.addBudgetItem('p-a','Exceso',.001),/importe/);assert.equal(calls.length,0);
});
test('gasto vuelve a leer el saldo y rechaza sobregiro antes de escribir',async()=>{
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.addExpense('b-a','p-a',450,'Compra','2026-10-15'),/saldo/);assert.ok(calls.every(c=>c.action==='read'));
});
test('no permite editar un rubro por debajo de lo ejecutado',async()=>{
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.updateBudgetItem('p-a','b-a','Materiales',100),/menor/);assert.equal(calls.length,1);
});
test('rechaza perfiles no disponibles en la institución',async()=>{
 const {service:s,calls}=service([ok(row),ok([])]);await assert.rejects(()=>s.addProjectMember('p-a',{profile_id:'otro',role:'Coordinador'}),/perfil/);assert.ok(!calls.some(c=>c.name==='project_operation'));
});
test('no asigna institución ni rol cuando faltan membresías',async()=>{
 const c=client([ok([])]);const module=load('src/modules/projects/integration/accessService.ts',{'../../../core/supabaseClient':{supabase:c.fake}});assert.equal((await module.getUserInstitutions('user-a')).length,0);assert.equal(c.calls.length,1);
});
test('URLs inseguras no se guardan ni renderizan; secciones ocultas no aparecen',async()=>{
 for(const value of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,x'])assert.equal(contract.safeUrl(value),undefined);
 const snapshot=snapshotFixture('Escuela');snapshot.menus=[{label:'Malicioso',url:'javascript:alert(1)'}];const p=portal([]);await assert.rejects(()=>p.module.savePortal('tenant-a',null,0,snapshot,false),/enlaces/);assert.equal(p.calls.length,0);
 snapshot.menus=[];snapshot.sections=[{id:'a',type:'text',is_visible:false,position:0,properties:{body:'NO PUBLICAR'}},{id:'b',type:'transparency',is_visible:true,position:1,properties:{title:'<script>alert(1)</script>'}}];
 const {PortalRenderer}=sharedPortalRenderer();const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot,institutionSlug:'escuela-a'}));assert.ok(!html.includes('NO PUBLICAR'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('institution=escuela-a'));
});
test('fechas imposibles e importes fuera de precision segura se rechazan sin escribir',async()=>{
 for(const date of ['2026-02-29','2026-04-31','0000-01-01','2026-13-01'])assert.equal(money.isCalendarDate(date),false);
 assert.equal(money.isCalendarDate('2028-02-29'),true);assert.equal(money.isMoney(1e16),false);
 const {service:s,calls}=service([]);
 await assert.rejects(()=>s.addExpense('b-a','p-a',10,'Compra','2026-02-30'),/fecha válida/);
 await assert.rejects(()=>s.createProject({name:'Proyecto',description:'',budget_total:10,start_date:'2026-02-30',end_date:''}),/calendario/);
 assert.equal(calls.length,0);
});
test('lector publico conserva la compatibilidad con paginas antiguas sin versiones',async()=>{
 const page={page_id:'old',institution_id:'tenant-a',status:'published',title:'Historia',slug:'historia',is_homepage:true};
 const p=portal([ok({institution_id:'tenant-a',slug:'escuela'}),ok({is_enabled:true}),ok([page]),ok([]),ok([]),ok({name:'Escuela'}),ok({site_title:'Escuela',logo_url:null,footer_text:'Contacto',theme_id:null}),ok([]),ok([{page_section_id:'s1',type:'text',position:0,is_visible:true,properties:{body:'Historia institucional'}}])]);
 const result=await p.module.loadPublishedPortal('escuela',null);assert.equal(result.snapshot.title,'Historia');assert.equal(result.snapshot.sections[0].properties.body,'Historia institucional');assert.ok(p.calls.every(c=>c.action==='read'));
});
test('portal público requiere habilitación explícita de su módulo',async()=>{
 for(const setting of [null,{is_enabled:false}]){
  const p=portal([ok({institution_id:'tenant-a',slug:'escuela'}),ok(setting)]);
  assert.equal(await p.module.loadPublishedPortal('escuela',null),null);
  assert.equal(p.calls.length,2);
 }
});
test('lector publico no presenta un borrador de una primera publicacion fallida',async()=>{
 const p=portal([ok({institution_id:'tenant-a',slug:'escuela'}),ok({is_enabled:true}),ok([{page_id:'p',slug:'inicio',status:'published',is_homepage:true}]),ok([]),ok([{publication_version_id:'draft'}])]);
 assert.equal(await p.module.loadPublishedPortal('escuela',null),null);
});
test('lector publico consulta versiones aprobadas y mantiene la institucion seleccionada',async()=>{
 const snapshot=snapshotFixture('Aprobado');const p=portal([ok({institution_id:'tenant-a',slug:'escuela'}),ok({is_enabled:true}),ok([{page_id:'p',slug:'inicio',status:'published',is_homepage:true}]),ok([{page_id:'p',version_number:1,content_snapshot:snapshot}])]);
 const result=await p.module.loadPublishedPortal('escuela','inicio');assert.equal(result.snapshot.settings.site_title,'Aprobado');assert.ok(p.calls[3].filters.some(f=>f[0]==='or'&&f[1].includes('eq.published')));assert.ok(p.calls[2].filters.some(f=>f[1]==='institution_id'&&f[2]==='tenant-a'));
});
test('acceso distingue error de permisos de ausencia de membresía',async()=>{
 const c=client([{data:null,error:{code:'42501'}}]);const service=load('src/modules/projects/integration/accessService.ts',{'../../../core/supabaseClient':{supabase:c.fake}});
 await assert.rejects(()=>service.getUserInstitutions('user-a'),/membresías.*42501/);
});
test('membresía sin rol visible informa el problema sin asignar un rol de reemplazo',async()=>{
 const c=client([ok([{institution_id:'tenant-a',role_id:'role-a'}]),ok([])]);const service=load('src/modules/projects/integration/accessService.ts',{'../../../core/supabaseClient':{supabase:c.fake}});
 await assert.rejects(()=>service.getUserInstitutions('user-a'),/rol no está visible/);assert.equal(c.calls.length,2);
});
test('rechazo de Supabase identifica la tabla sin ocultar el código de permisos',()=>{
 const module=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:{}},'./projectValidation':money});
 const message=module.projectError({code:'42501',message:'permission denied for table budget_items'});
 assert.ok(message.includes('budget_items'));assert.ok(message.includes('42501'));assert.ok(!message.includes('Ejecuta'));
});
test('el porcentaje financiero redondea la mitad hacia arriba sin error binario',()=>{
 assert.equal(money.executionPercent(1000,150.25),15.03);assert.equal(money.executionPercent(1000,150.24),15.02);
 assert.equal(money.executionPercent(0,0),0);assert.equal(money.executionPercent(10,.01),.1);assert.equal(money.executionPercent(1000,1000),100);
});
test('hoy se calcula en Ecuador continental aunque UTC ya esté en el día siguiente',()=>{
 assert.equal(money.ecuadorToday(new Date('2026-10-16T02:00:00Z')),'2026-10-15');
 assert.equal(money.ecuadorToday(new Date('2026-10-16T05:00:00Z')),'2026-10-16');
});
test('inicio hoy y proyecto de un solo día son válidos dentro del año lectivo',()=>{
 assert.doesNotThrow(()=>money.validateProjectDates('2026-10-15','2026-10-15',period,'2026-10-15'));
 assert.doesNotThrow(()=>money.validateProjectDates('2026-10-16','2027-03-11',period,'2026-10-15'));
});
test('inicio pasado, final invertido y fecha ausente se rechazan',()=>{
 assert.throws(()=>money.validateProjectDates('2026-10-14','2026-11-01',period,'2026-10-15'),/hoy/);
 assert.throws(()=>money.validateProjectDates('2026-10-16','2026-10-15',period,'2026-10-15'),/anterior/);
 assert.throws(()=>money.validateProjectDates('','2026-11-01',period,'2026-10-15'),/calendario/);
});
test('no se permite terminar después del cierre lectivo ni programar a varios años',()=>{
 assert.throws(()=>money.validateProjectDates('2026-10-15','2027-03-12',period,'2026-10-15'),/período lectivo/);
 assert.throws(()=>money.validateProjectDates('2030-01-01','2030-02-01',period,'2026-10-15'),/más de un año/);
});
test('período futuro limita el inicio y un período terminado bloquea la creación',()=>{
 const upcoming={...period,start_date:'2027-05-01',end_date:'2028-03-01'};
 const bounds=money.projectDateWindow(upcoming,'2027-04-15');assert.equal(bounds.min,'2027-05-01');assert.equal(bounds.max,'2028-03-01');
 assert.throws(()=>money.validateProjectDates('2027-04-15','2027-06-01',upcoming,'2027-04-15'),/período lectivo/);
 assert.throws(()=>money.projectDateWindow(period,'2027-03-12'),/No hay fechas/);
});
test('rechaza configuración lectiva multianual o inválida',()=>{
 assert.throws(()=>money.projectDateWindow({...period,end_date:'2030-03-01'},'2026-10-15'),/supera un año/);
 assert.throws(()=>money.projectDateWindow({...period,end_date:'2026-02-30'},'2026-10-15'),/inválidas/);
});
test('el horizonte de un año contempla el 29 de febrero',()=>{
 assert.doesNotThrow(()=>money.validateProjectDates('2028-02-29','2029-02-28',undefined,'2028-02-29'));
 assert.throws(()=>money.validateProjectDates('2028-02-29','2029-03-01',undefined,'2028-02-29'),/más de un año/);
});
test('crear revalida el cierre lectivo y no escribe cuando las fechas quedan fuera',async()=>{
 const {service:s,calls}=service([ok([period])]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:'2026-10-15',end_date:'2027-03-12'}),/período lectivo/);assert.ok(calls.every(c=>c.action==='read'));
});
test('período duplicado o error de conexión no provoca una escritura de proyecto',async()=>{
 for(const response of [ok([period,period]),{data:null,error:{code:'503',message:'Service unavailable'}}]){
   const {service:s,calls}=service([response]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:'2026-10-15',end_date:'2026-11-01'}));assert.ok(calls.every(c=>c.action==='read'));
 }
});
test('sin período visible se devuelven límites de planificación sin inventar un año lectivo',async()=>{
 const {service:s}=service([ok([])]);assert.equal(await s.getAcademicPeriod(),null);
 const bounds=money.projectDateWindow(null,'2026-10-15');assert.equal(bounds.min,'2026-10-15');assert.equal(bounds.max,'2027-10-15');
});
test('las fechas pasadas o a más de un año se rechazan antes de consultar el período opcional',async()=>{
 for(const [start,end] of [['2026-10-14','2026-11-01'],['2026-10-15','2027-10-16']]){
 const {service:s,calls}=service([]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:start,end_date:end}));assert.equal(calls.length,0);
 }
});
test('presupuesto inválido, negativo o superior a NUMERIC(12,2) se rechaza antes de consultar',async()=>{
 for(const amount of [-1,.001,Infinity,NaN,10000000000]){
   const {service:s,calls}=service([]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:amount,start_date:'2026-10-15',end_date:'2026-11-01'}),/importe/);assert.equal(calls.length,0);
 }
});

test('página nueva no inventa portada, ruta ni contenido institucional',()=>{
 const snapshot=contract.newSnapshot('Institución de la sesión');
 assert.equal(snapshot.settings.site_title,'Institución de la sesión');assert.equal(snapshot.title,'');assert.equal(snapshot.slug,'');assert.equal(snapshot.is_homepage,false);assert.equal(snapshot.sections.length,0);assert.equal(snapshot.menus.length,0);assert.equal(snapshot.settings.footer_text,'');
});

test('configuración de página nueva usa identidad, tema y menú de la institución',async()=>{
 const p=portal([ok({site_title:'Nombre configurado',logo_url:'https://example.test/logo.png',footer_text:'Pie registrado',theme_id:'theme-real'}),ok([{label:'Biblioteca',url:'/biblioteca'}]),ok({primary_color:'#112233',secondary_color:'#ddeeff',font_family:'Tahoma',appearance_config:{template:'editorial'}})]);
 const snapshot=await p.module.loadPortalConfiguration('tenant-a','Nombre de sesión');
 assert.equal(snapshot.settings.site_title,'Nombre configurado');assert.equal(snapshot.settings.footer_text,'Pie registrado');assert.equal(snapshot.theme.font_family,'Tahoma');assert.equal(snapshot.template,'editorial');assert.equal(snapshot.menus[0].label,'Biblioteca');assert.equal(snapshot.sections.length,0);
 assert.ok(p.calls.every(c=>c.filters.some(f=>f[1]==='institution_id'&&f[2]==='tenant-a')));assert.ok(p.calls[2].filters.some(f=>f[1]==='theme_id'&&f[2]==='theme-real'));
});

test('sin configuración registrada se usa el nombre de sesión y contenido vacío',async()=>{
 const p=portal([ok(null),ok([])]);const snapshot=await p.module.loadPortalConfiguration('tenant-a','Nombre real de sesión');
 assert.equal(snapshot.settings.site_title,'Nombre real de sesión');assert.equal(snapshot.settings.logo_url,'');assert.equal(snapshot.sections.length,0);
});

test('permisos de configuración y catálogo no se sustituyen por datos ficticios',async()=>{
 const failure={code:'42501',message:'denied'};
 const p=portal([{data:null,error:failure},ok([])]);await assert.rejects(()=>p.module.loadPortalConfiguration('tenant-a','Nombre'),e=>e===failure);
 const catalog=portal([{data:null,error:failure}]);await assert.rejects(()=>catalog.module.loadSectionCatalog(),e=>e===failure);
});

test('catálogo dinámico conserva propiedades registradas y no inventa tipos disponibles',async()=>{
 const p=portal([ok([{type:'text',default_properties:{title:'Título de catálogo',body:'Texto autorizado'}},{type:'unsupported',default_properties:{}},{type:'gallery',default_properties:null}])]);
 const rows=await p.module.loadSectionCatalog();assert.equal(rows.length,2);assert.equal(rows[0].default_properties.title,'Título de catálogo');assert.equal(Object.keys(rows[1].default_properties).length,0);assert.ok(p.calls[0].filters.some(f=>f[1]==='is_active'&&f[2]===true));
 const empty=portal([ok([])]);assert.equal((await empty.module.loadSectionCatalog()).length,0);
});

test('tipografía libre respeta el tamaño de la columna sin escribir datos inválidos',async()=>{
 for(const font of ['   ','x'.repeat(101)]){const snapshot=snapshotFixture('Colegio');snapshot.theme.font_family=font;const p=portal([]);await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',0,snapshot,false),/tipografía/);assert.equal(p.calls.length,0);}
});

test('integración conserva permisos explícitos de módulos y no habilita ausentes',async()=>{
 const c=client([ok([{institution_id:'tenant-a',role_id:'role-a'}]),ok([{role_id:'role-a',name:'institution_admin'}]),ok([{institution_id:'tenant-a',name:'Colegio',slug:'colegio',is_active:true}])]);
 c.fake.rpc=async name=>{assert.equal(name,'get_accessible_module_settings');return ok([{institution_id:'tenant-a',module_name:'inicio',is_enabled:true},{institution_id:'tenant-a',module_name:'projects',is_enabled:false},{institution_id:'other',module_name:'portal',is_enabled:true}]);};
 const service=load('src/modules/projects/integration/accessService.ts',{'../../../core/supabaseClient':{supabase:c.fake}});const [institution]=await service.getUserInstitutions('user-a');
 assert.equal(institution.module_permissions.inicio,true);assert.equal(institution.projects_enabled,false);assert.equal(institution.module_permissions.portal,false);assert.equal(institution.enabled_modules.join(','),'inicio');
});

test('fallo al consultar permisos de módulos no concede acceso por defecto',async()=>{
 const c=client([ok([{institution_id:'tenant-a',role_id:'role-a'}]),ok([{role_id:'role-a',name:'institution_admin'}]),ok([{institution_id:'tenant-a',name:'Colegio',slug:'colegio',is_active:true}])]);
 c.fake.rpc=async()=>({data:null,error:{code:'42501'}});
 const service=load('src/modules/projects/integration/accessService.ts',{'../../../core/supabaseClient':{supabase:c.fake}});await assert.rejects(()=>service.getUserInstitutions('user-a'),/módulos.*42501/);
});

test('edición de proyecto conserva fechas históricas y envía la revisión abierta',async()=>{
 const {service:s,calls}=service([ok(row),ok({})],7);
 await s.updateProject('p-a',{name:' Huerto corregido ',description:' Objetivo nuevo ',budget_total:1100,start_date:'2026-10-01',end_date:'2026-11-30'});
 assert.equal(calls[1].operation,'update_project');assert.equal(calls[1].payload.expected_revision,7);
 assert.equal(calls[1].payload.name,'Huerto corregido');assert.equal(calls[1].payload.description,'Objetivo nuevo');
});
test('editar proyecto no permite reducir presupuesto bajo los rubros ni excluir gastos',async()=>{
 for(const change of [{budget_total:599},{end_date:'2026-10-10'}]){
  const {service:s,calls}=service([ok(row)],3);
  await assert.rejects(()=>s.updateProject('p-a',{name:'Huerto',description:'Objetivo',budget_total:1000,start_date:'2026-10-01',end_date:'2026-11-30',...change}));
  assert.equal(calls.length,1);
 }
});
test('edición de gasto usa el saldo más el importe original, sin contar dos veces',async()=>{
 const {service:s,calls}=service([ok(row),ok({})],8);
 await s.updateExpense('b-a','p-a','e-a',600,' Semillas corregidas ','2026-10-15');
 assert.equal(calls[1].operation,'update_expense');assert.equal(calls[1].payload.expected_revision,8);assert.equal(calls[1].payload.amount,600);
 const failure=service([ok(row)],8);
 await assert.rejects(()=>failure.service.updateExpense('b-a','p-a','e-a',600.01,'Semillas','2026-10-15'),/saldo/);
 assert.equal(failure.calls.length,1);
});
test('gastos futuros o fuera del proyecto se rechazan tanto al crear como al editar',async()=>{
 for(const date of ['2026-09-30','2026-10-16','2026-12-01']){
  for(const edit of [false,true]){
   const {service:s,calls}=service([ok(row)],2);
   await assert.rejects(()=>edit?s.updateExpense('b-a','p-a','e-a',20,'Compra',date):s.addExpense('b-a','p-a',20,'Compra',date),/fecha/);
   assert.equal(calls.length,1);
  }
 }
});
test('los registros retirados no inflan gastos, asignaciones ni participantes',()=>{
 const module=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:{}},'./projectValidation':money});
 const archived={...row,revision:12,deleted_at:'2026-10-22',budget_items:[{...row.budget_items[0],expenses:[...row.budget_items[0].expenses,{amount:999,deleted_at:'2026-10-22'}]},{allocated_amount:1000,deleted_at:'2026-10-22',expenses:[]}],project_members:[{project_member_id:'retired',deleted_at:'2026-10-22'}]};
 const result=module.mapProject(archived);
 assert.equal(result.revision,12);assert.equal(result.deleted_at,'2026-10-22');assert.equal(result.budget_items.length,1);assert.equal(result.budget_items[0].expenses.length,1);assert.equal(result.budget_items[0].spent_amount,150.25);assert.equal(result.members.length,0);
});
test('archivo, restauración y responsabilidad solo usan operaciones atómicas',async()=>{
 const {service:s,calls}=service([ok({}),ok({}),ok({})]);
 await s.archiveProject('p-a');await s.restoreProject('p-a',11);await s.updateProjectMember('p-a','member-a',' Responsable financiero ');
 assert.deepEqual(calls.map(c=>c.operation),['archive_project','restore_project','update_member']);
 assert.equal(calls[1].payload.expected_revision,11);assert.equal(calls[2].payload.role,'Responsable financiero');
 assert.ok(calls.every(c=>c.action==='rpc'&&c.target_institution==='tenant-a'));
});
test('un conflicto de edición se propaga y no simula un guardado',async()=>{
 const conflict={code:'40001',message:'Actualiza antes de guardar'};
 const {service:s}=service([ok(row),{data:null,error:conflict}],4);
 await assert.rejects(()=>s.updateExpense('b-a','p-a','e-a',20,'Compra','2026-10-15'),error=>error===conflict);
});
test('la lista recorre lotes del servidor sin cortar en la primera página',async()=>{
 const {service:s,calls}=service([ok(Array.from({length:200},(_,i)=>({...row,project_id:'project-'+i}))),ok([{...row,project_id:'last'}])]);
 assert.equal((await s.getProjects()).data.length,201);
 assert.deepEqual(calls.map(c=>c.range),[[0,199],[200,399]]);
});

test('una base anterior no puede ejecutar los endpoints de borrado físico',async()=>{
 const legacy={...row};delete legacy.revision;
 for(const remove of [s=>s.deleteExpense('b-a','p-a','e-a'),s=>s.deleteBudgetItem('p-a','b-a'),s=>s.removeProjectMember('p-a','member-a')]){
  const {service:s,calls}=service([ok(legacy)]);
  await assert.rejects(()=>remove(s),/eliminación lógica/);assert.equal(calls.length,1);assert.equal(calls[0].action,'read');
 }
});
test('publicar se bloquea si el servidor todavía reemplaza contenido con borrado físico',async()=>{
 const p=portal([]);const calls=[];p.fake.rpc=async name=>{if(name==='portal_editor_content_version')return ok(2);calls.push(name);return {data:null,error:{code:'PGRST202'}};};
 await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',1,snapshotFixture('Colegio'),true),/historial/);
 assert.deepEqual(calls,['portal_editor_retention_version']);
});

test('la lectura atómica conserva revisión y todos los movimientos sin consultas parciales',async()=>{
 const c=client([]);const requests=[];
 c.fake.rpc=async(name,args)=>{requests.push({name,...args});return ok([{...row,revision:9}]);};
 const s=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:c.fake},'./projectValidation':money}).createProjectService('tenant-a');
 const project=await s.getProject('p-a');assert.equal(project.revision,9);assert.equal(project.budget_items[0].spent_amount,150.25);
 assert.equal(requests[0].target_project,'p-a');assert.equal(requests[0].target_institution,'tenant-a');assert.equal(c.calls.length,0);
});
test('una denegación en lectura atómica no intenta acceder por una ruta alternativa',async()=>{
 const c=client([]);const denied={code:'42501',message:'Acceso no autorizado'};c.fake.rpc=async()=>({data:null,error:denied});
 const s=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:c.fake},'./projectValidation':money}).createProjectService('tenant-a');
 await assert.rejects(()=>s.getProjects(),error=>error===denied);assert.equal(c.calls.length,0);
});
test('la dirección de una página se genera desde su título sin tildes ni símbolos',()=>{
 assert.equal(contract.slugify('Oferta Educativa 2026'),'oferta-educativa-2026');
 assert.equal(contract.slugify('  Misión y Visión ¡Nueva!  '),'mision-y-vision-nueva');
 assert.equal(contract.slugify('???'),'');
 assert.ok(contract.slugify('a'.repeat(140)).length<=100);
});
test('los destinos de enlaces ofrecen secciones fijas y páginas publicadas sin duplicados',()=>{
 const {portalDestinations}=load('src/modules/portal-editor/LinkDestination.tsx',{'react/jsx-runtime':require('react/jsx-runtime'),'./contract':contract,'./LinkDestination.module.css':{default:{}}});
 const list=portalDestinations([{title:'Contacto duplicado',slug:'contacto'},{title:'Becas',slug:'becas'},{title:'',slug:''}]);
 assert.ok(list.some(item=>item.label==='Transparencia'&&item.url==='/?slug=transparencia'));
 assert.equal(list.filter(item=>item.url==='/?slug=contacto').length,1);
 assert.equal(JSON.stringify(list.filter(item=>item.group==='Páginas creadas').map(item=>item.url)),JSON.stringify(['/?slug=becas']));
 assert.equal(list.filter(item=>item.url==='/').length,1);
});
test('la confirmación propia resuelve una sola vez y reemplaza una solicitud pendiente',async()=>{
 const confirm=load('src/shared/components/ConfirmDialog/confirm.ts');
 const seen=[];const stop=confirm.subscribeConfirm(request=>seen.push(request?.title??null));
 const first=confirm.confirmAction({title:'Primera'});
 const second=confirm.confirmAction({title:'Segunda',tone:'danger'});
 assert.equal(await first,false);
 confirm.settleConfirm(true);assert.equal(await second,true);
 assert.deepEqual(seen,[null,'Primera','Segunda',null]);
 stop();
});
test('la portada guarda de cero a varios botones y conserva los campos antiguos para el portal',()=>{
 const banner=properties=>contract.normalizeSnapshot({...contract.newSnapshot('Escuela'),sections:[{id:'b',type:'banner',position:0,is_visible:true,properties}]}).sections[0].properties;
 const none=banner({buttons:[],url:'/?slug=contacto',link_label:'Viejo',secondary_label:'Otro',secondary_url:'/'});
 assert.equal(none.button_url,undefined);assert.equal(none.secondary_url,undefined);assert.equal(none.url,undefined);
 const three=banner({buttons:[{id:'1',label:'Oferta',url:'/?slug=oferta-educativa'},{id:'2',label:'Contacto',url:'/?slug=contacto'},{id:'3',label:'Becas',url:'https://becas.example'}]});
 assert.equal(three.button_label,'Oferta');assert.equal(three.secondary_url,'/?slug=contacto');assert.equal(three.buttons.length,3);
 const legacy=banner({url:'/?slug=contacto',link_label:'Contáctanos'});
 assert.equal(legacy.button_url,'/?slug=contacto');assert.equal(legacy.button_label,'Contáctanos');
 assert.equal(banner({limit:500}).limit,24);assert.equal(banner({limit:'3'}).limit,3);assert.equal(banner({limit:0}).limit,1);
});
test('los botones antiguos de la portada se convierten en lista editable',()=>{
 const {bannerButtons}=load('src/modules/portal-editor/ButtonList.tsx',{'react/jsx-runtime':require('react/jsx-runtime'),'./contract':contract,'./LinkDestination':{LinkDestination:()=>null},'./ButtonList.module.css':{default:{}}});
 assert.equal(JSON.stringify(bannerButtons({link_label:'Oferta',url:'/?slug=oferta-educativa',secondary_label:'',secondary_url:''}).map(b=>b.label)),'["Oferta"]');
 assert.equal(bannerButtons({buttons:[]}).length,0);
 assert.equal(bannerButtons({}).length,0);
});
test('las páginas publicadas por el portal se abren en el editor con su contenido real',()=>{
 const {module}=portal([]);
 const config=contract.newSnapshot('Unidad Educativa Luz de América');config.settings.contact_email='info@example.test';config.template='cards';
 // Same shape as the public portal pages: no schema_version, only sections (and sometimes template).
 const content={sections:[{type:'hero',properties:{title:'Oferta educativa',subtitle:'Bachillerato'}},{type:'text',position:1,properties:{title:'Niveles',body:'Inicial, EGB y BGU'}},{type:'links',properties:{items:[{title:'Matrículas',url:'/?slug=contacto'}]}}]};
 const page=module.legacyPublishedSnapshot({title:'Oferta educativa',slug:'oferta-educativa',is_homepage:false},content,config);
 assert.equal(page.title,'Oferta educativa');assert.equal(page.slug,'oferta-educativa');assert.equal(page.publication_state,'published');
 assert.equal(JSON.stringify(page.sections.map(s=>s.type)),'["banner","text","links"]');
 assert.equal(page.sections[1].properties.body,'Inicial, EGB y BGU');
 assert.equal(page.settings.contact_email,'info@example.test');assert.equal(page.template,'classic');
 page.settings.site_title='Cambio local';assert.equal(config.settings.site_title,'Unidad Educativa Luz de América');
});
test('presupuesto escrito en el formulario llega intacto al RPC: «500», «350,20» y «350.20» nunca se guardan como 0',async()=>{
 const presentationModule=load('src/modules/projects/projectPresentation.ts',{'./projectValidation':money});
 const forms=load('src/modules/projects/projectForms.ts',{'./projectValidation':money,'./projectPresentation':presentationModule});
 const data=budget=>{const d=new FormData();for(const [k,v] of Object.entries({name:'Huerto',budget,start:'2026-10-15',end:'2026-11-01',description:'Objetivo'}))d.set(k,v);return d;};
 for(const [typed,expected] of [['500',500],['350,20',350.2],['350.20',350.2],[' 1000,5 ',1000.5]]){
  const checked=forms.validateProjectForm(data(typed));assert.equal(checked.ok,true,typed);assert.equal(checked.values.budget_total,expected,typed);
  const {service:s,calls}=service([ok([period]),ok(row)]);await s.createProject(checked.values);
  assert.equal(calls[1].operation,'create_project');assert.equal(calls[1].payload.budget_total,expected,'payload de '+typed);
  const bare={...row,budget_items:[]};const edit=service([ok(bare),ok(bare)]);await edit.service.updateProject('p-a',{...checked.values,budget_total:expected});
  assert.equal(edit.calls.at(-1).operation,'update_project');assert.equal(edit.calls.at(-1).payload.budget_total,expected,'edición de '+typed);
 }
 // The old reader (Number of an empty type=number value) turned an unreadable amount into 0; now it is an error under the field.
 for(const typed of ['','   ','350,20,1','abc']){const checked=forms.validateProjectForm(data(typed));assert.equal(checked.ok,false,typed);assert.ok(checked.errors.budget,typed);}
 assert.equal(forms.validateProjectForm(data('0')).values.budget_total,0,'0 explícito sigue permitido');
});
