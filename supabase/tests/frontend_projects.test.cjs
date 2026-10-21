const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,imports={}){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,crypto:require('node:crypto').webcrypto,require:name=>{if(name in imports)return imports[name];if(['react','lucide-react'].includes(name))return require(name);throw new Error('Unexpected import '+name);}});return exports;
}
function client(responses){
 const calls=[];
 const fake={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from(table){const call={table,action:'read',filters:[]};let done=false;
 const execute=()=>{if(done)throw new Error('Query executed twice');done=true;calls.push(call);assert.ok(responses.length,'Unexpected query: '+JSON.stringify(call));return Promise.resolve(responses.shift());};
 const query={select(columns){call.columns=columns;return query;},insert(payload){call.action='insert';call.payload=payload;return query;},update(payload){call.action='update';call.payload=payload;return query;},delete(){call.action='delete';return query;},upsert(payload){call.action='upsert';call.payload=payload;return query;},eq(key,value){call.filters.push(['eq',key,value]);return query;},in(key,value){call.filters.push(['in',key,value]);return query;},or(value){call.filters.push(['or',value]);return query;},neq(key,value){call.filters.push(['neq',key,value]);return query;},order(){return query;},limit(){return query;},single:execute,maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject);}};return query;},rpc:async(name,args)=>{calls.push({action:'rpc',name,...args});assert.ok(responses.length,'Unexpected RPC '+name);return responses.shift();}};
 return {fake,calls};
}
const money=load('src/modules/projects/projectValidation.ts');
const contract=load('src/modules/portal-editor/contract.ts');
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
 const visuals=load('src/modules/projects/ProjectVisuals.tsx',{'./projectValidation':money,'./projectPresentation':presentation,'react/jsx-runtime':jsx});
 function render(pending){
  const rows=[{project_id:'p-a',title:'Huerto público',description:'Objetivo aprobado',is_active:true,total_budget:1000,spent:250,balance:750,participants:'PERSONA PRIVADA',receipt:'COMPROBANTE PRIVADO'}];
  const values=['escuela',0,{revision:0,rows:[{name:'Escuela de prueba',slug:'escuela'}],error:''},pending?null:{key:'escuela:0',rows,error:'',checkedAt:'20 oct 2026'},'','all','name','cards',''];let i=0;
  const {PublicProjects}=load('src/modules/projects/PublicProjects.tsx',{'react':{...react,useEffect:()=>{},useState:()=>[values[i++],()=>{}]},'../../core/supabaseClient':{supabase:{}},'./projectValidation':money,'./projectPresentation':presentation,'./ProjectVisuals':visuals,'./projects.css':{},'react/jsx-runtime':jsx});
  return require('react-dom/server').renderToStaticMarkup(react.createElement(PublicProjects));
 }
 const html=render(false);assert.ok(html.includes('Huerto público'));assert.ok(html.includes('Escuela de prueba'));assert.ok(!html.includes('PERSONA PRIVADA'));assert.ok(!html.includes('COMPROBANTE PRIVADO'));
 const pending=render(true);assert.ok(pending.includes('Consultando información pública'));assert.ok(!pending.includes('Saldo por ejecutar'));assert.ok(!pending.includes('Huerto público'));
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
test('portal: logo accesible, navegación pública y vista previa sin enlaces activos',()=>{
 const snapshot=contract.newSnapshot('Colegio de prueba');snapshot.title='Inicio';snapshot.settings.logo_url='https://example.test/logo.png';snapshot.menus=[{label:'Contacto',url:'/contacto'}];
 snapshot.sections=[{id:'links',type:'links',is_visible:true,position:0,properties:{url:'/documento',link_label:'Documento'}}];
 const normalized=contract.normalizeSnapshot(snapshot);
 const {PortalRenderer}=load('src/modules/portal-editor/PortalRenderer.tsx',{'./contract':contract,'./portal.css':{},'react/jsx-runtime':require('react/jsx-runtime')});
 const render=preview=>require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot:normalized,institutionSlug:'escuela',preview}));
 const html=render(false);assert.ok(html.includes('alt="Logotipo de Colegio de prueba"'));assert.ok(html.includes('href="/contacto"'));
 assert.equal((html.match(/href="\/documento"/g)||[]).length,1);
 const preview=render(true);assert.ok(preview.includes('aria-disabled="true"'));assert.ok(!preview.includes('href="/contacto"'));assert.ok(!preview.includes('href="/documento"'));
});
function snapshotFixture(name){return {...contract.newSnapshot(name),title:'Inicio',slug:'inicio',is_homepage:true,sections:[{id:'banner-fixture',type:'banner',position:0,is_visible:true,properties:{title:name}}]};}
const row={project_id:'p-a',institution_id:'tenant-a',title:'Huerto',description:'Objetivo',total_budget:'1000.00',is_public:false,start_date:'2026-10-01',end_date:'2026-11-30',budget_items:[{budget_item_id:'b-a',project_id:'p-a',name:'Materiales',allocated_amount:'600',expenses:[{expense_id:'e-a',budget_item_id:'b-a',amount:'150.25',description:'Semillas',expense_date:'2026-10-16'}]}],project_members:[]};
function service(responses){const c=client(responses);return {...c,service:load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:c.fake},'./projectValidation':money}).createProjectService('tenant-a',()=> '2026-10-15')};}
const ok=data=>({data,error:null});
const period={academic_period_id:'period-a',name:'Costa 2026-2027',start_date:'2026-05-04',end_date:'2027-03-11'};
function portal(responses){const c=client(responses);const module=load('src/modules/portal-editor/portalService.ts',{'../../core/supabaseClient':{supabase:c.fake},'../../core/institutionService':{getUserInstitutions:async()=>[{institution_id:'tenant-a',role:'institution_admin',enabled_modules:['portal']}]},'./contract':contract,'../site/utils/snapshot':load('src/modules/site/utils/snapshot.ts')});return {...c,module};}

test('crear proyecto envía institución, fechas e importe a la operación atómica',async()=>{
 const {service:s,calls}=service([ok([period]),ok(row)]);
 await s.createProject({name:' Huerto ',description:'Objetivo',budget_total:250000,start_date:'2026-10-15',end_date:'2026-11-01'});
 assert.equal(calls[1].name,'project_operation');assert.equal(calls[1].target_institution,'tenant-a');
 assert.equal(calls[1].operation,'create_project');assert.equal(calls[1].payload.budget_total,250000);assert.equal(calls[1].payload.name,'Huerto');
 assert.ok(calls.every(c=>c.action==='read'||c.action==='rpc'));
});
test('gasto conserva la validación local y delega el saldo final al servidor',async()=>{
 const {service:s,calls}=service([ok(row),ok({expense_id:'new',budget_item_id:'b-a',amount:'25.20',description:'Compra',expense_date:'2026-10-16'})]);
 const saved=await s.addExpense('b-a','p-a',25.2,'Compra','2026-10-16');
 assert.equal(saved.amount,25.2);assert.equal(calls[1].operation,'add_expense');assert.equal(calls[1].payload.project_id,'p-a');assert.equal(calls[1].payload.budget_item_id,'b-a');
 assert.ok(!('created_by' in calls[1].payload));
});
test('rechazo concurrente del servidor no se presenta como gasto guardado',async()=>{
 const failure={code:'P0001',message:'El gasto supera el saldo del rubro. Actualiza los datos.'};
 const {service:s}=service([ok(row),{data:null,error:failure}]);await assert.rejects(()=>s.addExpense('b-a','p-a',25,'Compra','2026-10-16'),e=>e===failure);
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
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.addExpense('b-a','p-a',450,'Compra','2026-10-16'),/saldo/);assert.ok(calls.every(c=>c.action==='read'));
});
test('no permite editar un rubro por debajo de lo ejecutado',async()=>{
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.updateBudgetItem('p-a','b-a','Materiales',100),/menor/);assert.equal(calls.length,1);
});
test('rechaza perfiles no disponibles en la institución',async()=>{
 const {service:s,calls}=service([ok(row),ok([])]);await assert.rejects(()=>s.addProjectMember('p-a',{profile_id:'otro',role:'Coordinador'}),/perfil/);assert.ok(!calls.some(c=>c.name==='project_operation'));
});
test('no asigna institución ni rol cuando faltan membresías',async()=>{
 const c=client([ok([])]);const module=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});assert.equal((await module.getUserInstitutions('user-a')).length,0);assert.equal(c.calls.length,1);
});
test('URLs inseguras no se guardan ni renderizan; secciones ocultas no aparecen',async()=>{
 for(const value of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,x'])assert.equal(contract.safeUrl(value),undefined);
 const snapshot=snapshotFixture('Escuela');snapshot.menus=[{label:'Malicioso',url:'javascript:alert(1)'}];const p=portal([]);await assert.rejects(()=>p.module.savePortal('tenant-a',null,0,snapshot,false),/enlaces/);assert.equal(p.calls.length,0);
 snapshot.menus=[];snapshot.sections=[{id:'a',type:'text',is_visible:false,position:0,properties:{body:'NO PUBLICAR'}},{id:'b',type:'transparency',is_visible:true,position:1,properties:{title:'<script>alert(1)</script>'}}];
 const {PortalRenderer}=load('src/modules/portal-editor/PortalRenderer.tsx',{'./contract':contract,'./portal.css':{},'react/jsx-runtime':require('react/jsx-runtime')});const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot,institutionSlug:'escuela-a'}));assert.ok(!html.includes('NO PUBLICAR'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('institution=escuela-a'));
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
 const c=client([{data:null,error:{code:'42501'}}]);const service=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});
 await assert.rejects(()=>service.getUserInstitutions('user-a'),/membresías.*42501/);
});
test('membresía sin rol visible informa el problema sin asignar un rol de reemplazo',async()=>{
 const c=client([ok([{institution_id:'tenant-a',role_id:'role-a'}]),ok([])]);const service=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});
 await assert.rejects(()=>service.getUserInstitutions('user-a'),/rol no está visible/);assert.equal(c.calls.length,2);
});
test('el control de acceso muestra el error real y ofrece reintentar sin abrir el módulo',()=>{
 const react=require('react');const {ModuleGate}=load('src/core/ModuleGate.tsx',{'react-router-dom':{Navigate:()=>null},'../pages/InstitutionalEntryPage':{InstitutionalEntryPage:()=>null},'./AuthContext':{useAuth:()=>({user:{id:'user-a'},loading:false})},'./TenantContext':{useTenant:()=>({activeInstitution:null,loadingTenant:false,tenantError:'Consulta de roles rechazada: 42501',reloadInstitutions:()=>{}})},'react/jsx-runtime':require('react/jsx-runtime')});
 const html=require('react-dom/server').renderToStaticMarkup(react.createElement(ModuleGate,{moduleName:'projects'},'CONTENIDO PRIVADO'));
 assert.ok(html.includes('Consulta de roles rechazada: 42501'));assert.ok(html.includes('Reintentar consulta'));assert.ok(!html.includes('CONTENIDO PRIVADO'));
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
 const service=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});const [institution]=await service.getUserInstitutions('user-a');
 assert.equal(institution.module_permissions.inicio,true);assert.equal(institution.projects_enabled,false);assert.equal(institution.module_permissions.portal,false);assert.equal(institution.enabled_modules.join(','),'inicio');
});

test('fallo al consultar permisos de módulos no concede acceso por defecto',async()=>{
 const c=client([ok([{institution_id:'tenant-a',role_id:'role-a'}]),ok([{role_id:'role-a',name:'institution_admin'}]),ok([{institution_id:'tenant-a',name:'Colegio',slug:'colegio',is_active:true}])]);
 c.fake.rpc=async()=>({data:null,error:{code:'42501'}});
 const service=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});await assert.rejects(()=>service.getUserInstitutions('user-a'),/módulos.*42501/);
});

test('control integrado conserva la entrada pública y redirección del estudiante',()=>{
 const react=require('react');const render=require('react-dom/server').renderToStaticMarkup;
 const state={user:null,activeInstitution:null,allowed:false};
 const {ModuleGate}=load('src/core/ModuleGate.tsx',{'./AuthContext':{useAuth:()=>({user:state.user,loading:false})},'./TenantContext':{useTenant:()=>({activeInstitution:state.activeInstitution,loadingTenant:false,hasModuleAccess:()=>state.allowed})},'react-router-dom':{Navigate:({to})=>react.createElement('span',null,to)},'../pages/InstitutionalEntryPage':{InstitutionalEntryPage:()=>react.createElement('span',null,'Entrada institucional')},'react/jsx-runtime':require('react/jsx-runtime')});
 assert.ok(render(react.createElement(ModuleGate,{moduleName:'inicio'},'PRIVADO')).includes('Entrada institucional'));
 state.user={id:'user-a'};state.activeInstitution={name:'Colegio',slug:'colegio',role:'student'};
 assert.ok(!render(react.createElement(ModuleGate,{moduleName:'dece'},'PRIVADO')).includes('/mi-ficha'));
 state.allowed=true;assert.ok(render(react.createElement(ModuleGate,{moduleName:'dece'},'PRIVADO')).includes('/colegio/mi-ficha'));
});
