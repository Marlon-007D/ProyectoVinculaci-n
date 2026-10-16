const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,imports={}){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,crypto:require('node:crypto').webcrypto,require:name=>{if(!(name in imports))throw new Error('Unexpected import '+name);return imports[name];}});return exports;
}
function client(responses){
 const calls=[];
 const fake={auth:{getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from(table){const call={table,action:'read',filters:[]};let done=false;
 const execute=()=>{if(done)throw new Error('Query executed twice');done=true;calls.push(call);assert.ok(responses.length,'Unexpected query: '+JSON.stringify(call));return Promise.resolve(responses.shift());};
 const query={select(columns){call.columns=columns;return query;},insert(payload){call.action='insert';call.payload=payload;return query;},update(payload){call.action='update';call.payload=payload;return query;},delete(){call.action='delete';return query;},upsert(payload){call.action='upsert';call.payload=payload;return query;},eq(key,value){call.filters.push(['eq',key,value]);return query;},in(key,value){call.filters.push(['in',key,value]);return query;},or(value){call.filters.push(['or',value]);return query;},neq(key,value){call.filters.push(['neq',key,value]);return query;},order(){return query;},limit(){return query;},single:execute,maybeSingle:execute,then(resolve,reject){return execute().then(resolve,reject);}};return query;},rpc(){throw new Error('No new RPC is permitted');}};
 return {fake,calls};
}
const money=load('src/modules/projects/projectValidation.ts');
const contract=load('src/modules/portal-editor/contract.ts');
function snapshotFixture(name){return {...contract.newSnapshot(name),title:'Inicio',slug:'inicio',is_homepage:true,sections:[{id:'banner-fixture',type:'banner',position:0,is_visible:true,properties:{title:name}}]};}
const row={project_id:'p-a',institution_id:'tenant-a',title:'Huerto',description:'Objetivo',total_budget:'1000.00',is_public:false,start_date:'2026-10-01',end_date:'2026-11-30',budget_items:[{budget_item_id:'b-a',project_id:'p-a',name:'Materiales',allocated_amount:'600',expenses:[{expense_id:'e-a',budget_item_id:'b-a',amount:'150.25',description:'Semillas',expense_date:'2026-10-16'}]}],project_members:[]};
function service(responses){const c=client(responses);return {...c,service:load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:c.fake},'./projectValidation':money}).createProjectService('tenant-a',()=> '2026-10-15')};}
const ok=data=>({data,error:null});
const period={academic_period_id:'period-a',name:'Costa 2026-2027',start_date:'2026-05-04',end_date:'2027-03-11'};
test('centavos y conversión de filas del esquema real',()=>{
 assert.equal(money.sumMoney([.1,.2]),.3);assert.equal(money.remainingMoney(1000,150.25),849.75);
 for(const n of [NaN,Infinity,-1,.001])assert.equal(money.isMoney(n),false);
 const module=load('src/modules/projects/projectService.ts',{'../../core/supabaseClient':{supabase:{}},'./projectValidation':money});const project=module.mapProject(row);
 assert.equal(project.budget_items[0].spent_amount,150.25);assert.equal(project.budget_total,1000);
});
test('lista vacía no recupera datos locales y filtra la institución',async()=>{
 const {service:s,calls}=service([ok([])]);assert.equal((await s.getProjects()).data.length,0);assert.deepEqual(calls[0].filters,[['eq','institution_id','tenant-a']]);
});
test('crear proyecto escribe exclusivamente columnas existentes',async()=>{
 const {service:s,calls}=service([ok([period]),ok({...row,budget_items:[]})]);await s.createProject({name:'Huerto',description:'Objetivo',budget_total:1000,start_date:'2026-10-15',end_date:'2026-11-30'});
 assert.equal(calls[0].table,'academic_periods');assert.deepEqual(calls[0].filters,[['eq','institution_id','tenant-a'],['eq','is_active',true]]);
 assert.deepEqual(Object.keys(calls[1].payload).sort(),['institution_id','title','description','total_budget','start_date','end_date','is_public'].sort());
 assert.equal(calls[1].payload.is_public,false);
});
test('rechazo de permisos se comunica sin simular éxito',async()=>{
 const failure={code:'42501',message:'denied'};const {service:s}=service([ok([period]),{data:null,error:failure}]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:10,start_date:'2026-10-15',end_date:'2026-11-01'}),e=>e===failure);
});
test('fechas invertidas e importes inválidos no llegan al servidor',async()=>{
 const {service:s,calls}=service([]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:10,start_date:'2026-11-01',end_date:'2026-10-01'}),/fecha final/);
 await assert.rejects(()=>s.addBudgetItem('p-a','Exceso',.001),/importe/);assert.equal(calls.length,0);
});
test('gasto vuelve a leer el saldo y rechaza sobregiro antes de escribir',async()=>{
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.addExpense('b-a','p-a',450,'Compra','2026-10-16'),/saldo/);assert.ok(calls.every(c=>c.action==='read'));
});
test('gasto usa fecha, concepto, importe y autor sin columna de factura inventada',async()=>{
 const {service:s,calls}=service([ok(row),ok({expense_id:'e-b',budget_item_id:'b-a',amount:25,description:'Compra FAC-01',expense_date:'2026-10-16'})]);
 const expense=await s.addExpense('b-a','p-a',25,'Compra FAC-01','2026-10-16');assert.equal(expense.date,'2026-10-16');assert.equal(calls[1].payload.created_by,'user-a');assert.ok(!('invoice_number'in calls[1].payload));
});
test('no permite editar un rubro por debajo de lo ejecutado',async()=>{
 const {service:s,calls}=service([ok(row)]);await assert.rejects(()=>s.updateBudgetItem('p-a','b-a','Materiales',100),/menor/);assert.equal(calls.length,1);
});
test('participantes se vinculan a un perfil de la institución',async()=>{
 const {service:s,calls}=service([ok(row),ok([{profile_id:'profile-a',profiles:{profile_id:'profile-a',first_name:'Persona',last_name:'Prueba',email:'prueba@example.test'}}]),ok({project_member_id:'member-a'})]);
 await s.addProjectMember('p-a',{profile_id:'profile-a',role:'Coordinador'});assert.deepEqual(Object.keys(calls[2].payload).sort(),['project_id','profile_id','role'].sort());
});
test('rechaza perfiles no disponibles en la institución',async()=>{
 const {service:s,calls}=service([ok(row),ok([])]);await assert.rejects(()=>s.addProjectMember('p-a',{profile_id:'otro',role:'Coordinador'}),/perfil/);assert.ok(calls.every(c=>c.action==='read'));
});
test('eliminación limita gasto por rubro y comprueba su proyecto',async()=>{
 const {service:s,calls}=service([ok(row),ok({expense_id:'e-a'})]);await s.deleteExpense('b-a','p-a','e-a');assert.deepEqual(calls[1].filters,[['eq','budget_item_id','b-a'],['eq','expense_id','e-a']]);
});
test('no asigna institución ni rol cuando faltan membresías',async()=>{
 const c=client([ok([])]);const module=load('src/core/institutionService.ts',{'./supabaseClient':{supabase:c.fake}});assert.equal((await module.getUserInstitutions('user-a')).length,0);assert.equal(c.calls.length,1);
});
function portal(responses){const c=client(responses);const module=load('src/modules/portal-editor/portalService.ts',{'../../core/supabaseClient':{supabase:c.fake},'../../core/institutionService':{getUserInstitutions:async()=>[{institution_id:'tenant-a',role:'institution_admin',enabled_modules:['portal']}]},'./contract':contract,'../site/utils/snapshot':load('src/modules/site/utils/snapshot.ts')});return {...c,module};}
test('borrador usa publication_versions existente sin tocar la configuración pública',async()=>{
 const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'published'}),ok([]),ok({publication_version_id:'v1'})]);const snapshot=snapshotFixture('Escuela');
 const result=await p.module.savePortal('tenant-a','page-a',0,snapshot,false);assert.equal(result.revision,1);const writes=p.calls.filter(c=>c.action!=='read');assert.equal(writes.length,1);assert.equal(writes[0].table,'publication_versions');assert.equal(writes[0].payload.content_snapshot.publication_state,'draft');
});
test('versión obsoleta del editor no sobrescribe el trabajo existente',async()=>{
 const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'published'}),ok([{version_number:2}])]);await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',1,snapshotFixture('Escuela'),false),/versión más reciente/);assert.ok(p.calls.every(c=>c.action==='read'));
});
test('URLs inseguras no se guardan ni renderizan; secciones ocultas no aparecen',async()=>{
 for(const value of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,x'])assert.equal(contract.safeUrl(value),undefined);
 const snapshot=snapshotFixture('Escuela');snapshot.menus=[{label:'Malicioso',url:'javascript:alert(1)'}];const p=portal([]);await assert.rejects(()=>p.module.savePortal('tenant-a',null,0,snapshot,false),/enlaces/);assert.equal(p.calls.length,0);
 snapshot.menus=[];snapshot.sections=[{id:'a',type:'text',is_visible:false,position:0,properties:{body:'NO PUBLICAR'}},{id:'b',type:'transparency',is_visible:true,position:1,properties:{title:'<script>alert(1)</script>'}}];
 const {PortalRenderer}=load('src/modules/portal-editor/PortalRenderer.tsx',{'./contract':contract,'./portal.css':{},'react/jsx-runtime':require('react/jsx-runtime')});const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(PortalRenderer,{snapshot,institutionSlug:'escuela-a'}));assert.ok(!html.includes('NO PUBLICAR'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('/proyectos?institution=escuela-a'));
});
test('publicación marca el snapshot como público solo después de guardar la configuración',async()=>{
 const snapshot=snapshotFixture('Escuela');snapshot.is_homepage=false;snapshot.menus=[];
 const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'draft'}),ok([]),ok([{type:'banner'}]),ok({publication_version_id:'v1'}),ok(null),ok({theme_id:'theme-a'}),ok({site_setting_id:'settings-a'}),ok(null),ok(null),ok(null),ok({page_id:'page-a'}),ok({publication_version_id:'v1'})]);
 const result=await p.module.savePortal('tenant-a','page-a',0,snapshot,true);
 assert.equal(result.status,'published');const last=p.calls.at(-1);assert.equal(last.table,'publication_versions');assert.equal(last.action,'update');assert.equal(last.payload.content_snapshot.publication_state,'published');assert.equal(last.payload.published_by,'user-a');
 assert.equal(p.calls.find(c=>c.table==='publication_versions'&&c.action==='insert').payload.content_snapshot.publication_state,'draft');
});
test('fallo de publicación conserva estado de borrador e informa cambios parciales',async()=>{
 const snapshot=snapshotFixture('Escuela');const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'published'}),ok([]),ok([{type:'banner'}]),ok({publication_version_id:'v1'}),{data:null,error:{message:'Permiso denegado'}}]);
 await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',0,snapshot,true),/cambios parciales/);
 assert.ok(!p.calls.some(c=>c.table==='publication_versions'&&c.action==='update'));
});
test('tipo de sección ausente del catálogo impide publicación antes de escribir',async()=>{
 const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'draft'}),ok([]),ok([])]);
 await assert.rejects(()=>p.module.savePortal('tenant-a','page-a',0,snapshotFixture('Escuela'),true),/catálogo existente/);
 assert.ok(p.calls.every(c=>c.action==='read'));
});

test('fechas imposibles e importes fuera de precision segura se rechazan sin escribir',async()=>{
 for(const date of ['2026-02-29','2026-04-31','0000-01-01','2026-13-01'])assert.equal(money.isCalendarDate(date),false);
 assert.equal(money.isCalendarDate('2028-02-29'),true);assert.equal(money.isMoney(1e16),false);
 const {service:s,calls}=service([]);
 await assert.rejects(()=>s.addExpense('b-a','p-a',10,'Compra','2026-02-30'),/fecha válida/);
 await assert.rejects(()=>s.createProject({name:'Proyecto',description:'',budget_total:10,start_date:'2026-02-30',end_date:''}),/calendario/);
 assert.equal(calls.length,0);
});
test('crear pagina con ruta ocupada no sobrescribe una pagina antigua sin versiones',async()=>{
 const p=portal([ok({page_id:'old',institution_id:'tenant-a',status:'published'})]);
 await assert.rejects(()=>p.module.savePortal('tenant-a',null,0,snapshotFixture('Escuela'),false),/Ya existe una página/);
 assert.ok(p.calls.every(c=>c.action==='read'));
});
test('lector publico conserva la compatibilidad con paginas antiguas sin versiones',async()=>{
 const page={page_id:'old',institution_id:'tenant-a',status:'published',title:'Historia',slug:'historia',is_homepage:true};
 const p=portal([ok({institution_id:'tenant-a',slug:'escuela'}),ok({is_enabled:true}),ok([page]),ok([]),ok([]),ok({name:'Escuela'}),ok({site_title:'Escuela',logo_url:null,footer_text:'Contacto',theme_id:null}),ok([]),ok([{page_section_id:'s1',type:'text',position:0,is_visible:true,properties:{body:'Historia institucional'}}])]);
 const result=await p.module.loadPublishedPortal('escuela',null);assert.equal(result.snapshot.title,'Historia');assert.equal(result.snapshot.sections[0].properties.body,'Historia institucional');assert.ok(p.calls.every(c=>c.action==='read'));
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
test('rechazo 42501 de academic_periods permite crear usando las fechas propias de projects',async()=>{
 const {service:s,calls}=service([{data:null,error:{code:'42501',message:'permission denied for table academic_periods'}},ok(row)]);
 await s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:'2026-10-15',end_date:'2026-11-01'});
 assert.equal(calls[1].table,'projects');assert.equal(calls[1].action,'insert');assert.equal(calls[1].payload.start_date,'2026-10-15');assert.ok(!('academic_period_id'in calls[1].payload));
});
test('sin período visible se devuelven límites de planificación sin inventar un año lectivo',async()=>{
 const {service:s}=service([ok([])]);assert.equal(await s.getAcademicPeriod(),null);
 const bounds=money.projectDateWindow(null,'2026-10-15');assert.equal(bounds.min,'2026-10-15');assert.equal(bounds.max,'2027-10-15');
});
test('el rechazo de lectura académica no oculta un rechazo al guardar el proyecto',async()=>{
 const denied={code:'42501',message:'permission denied for table projects'};
 const {service:s}=service([{data:null,error:{code:'42501'}},{data:null,error:denied}]);
 await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:'2026-10-15',end_date:'2026-11-01'}),e=>e===denied);
});
test('las fechas pasadas o a más de un año se rechazan antes de consultar el período opcional',async()=>{
 for(const [start,end] of [['2026-10-14','2026-11-01'],['2026-10-15','2027-10-16']]){
 const {service:s,calls}=service([]);await assert.rejects(()=>s.createProject({name:'Proyecto',description:'Objetivo',budget_total:1000,start_date:start,end_date:end}));assert.equal(calls.length,0);
 }
});
test('el presupuesto admite importes reales sin un techo artificial del colegio',async()=>{
 const {service:s,calls}=service([ok([period]),ok({...row,total_budget:50000})]);await s.createProject({name:'Proyecto',description:'Objetivo',budget_total:50000,start_date:'2026-10-15',end_date:'2026-11-01'});assert.equal(calls[1].payload.total_budget,50000);
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

test('publicación usa el tema vinculado y conserva su nombre y configuración adicional',async()=>{
 const snapshot=snapshotFixture('Colegio');snapshot.is_homepage=false;
 const p=portal([ok({page_id:'page-a',institution_id:'tenant-a',status:'draft'}),ok([]),ok([{type:'banner'}]),ok({publication_version_id:'v1'}),ok({theme_id:'theme-configurado'}),ok({appearance_config:{spacing:'compact',template:'cards'}}),ok({theme_id:'theme-configurado'}),ok({site_setting_id:'settings-a'}),ok(null),ok(null),ok(null),ok({page_id:'page-a'}),ok({publication_version_id:'v1'})]);
 await p.module.savePortal('tenant-a','page-a',0,snapshot,true);
 const update=p.calls.find(c=>c.table==='themes'&&c.action==='update');assert.ok(update);assert.ok(!('name' in update.payload));assert.equal(update.payload.appearance_config.spacing,'compact');assert.equal(update.payload.appearance_config.template,snapshot.template);assert.ok(update.filters.some(f=>f[1]==='theme_id'&&f[2]==='theme-configurado'));assert.ok(!p.calls.some(c=>c.filters.some(f=>f[1]==='name')));
});

test('responsabilidad acepta texto institucional y valida la columna VARCHAR(100)',async()=>{
 const {service:s,calls}=service([ok(row),ok([{profile_id:'profile-a',profiles:{profile_id:'profile-a',first_name:'Persona',last_name:'Prueba',email:''}}]),ok({project_member_id:'member-a'})]);
 await s.addProjectMember('p-a',{profile_id:'profile-a',role:'  Responsable de biblioteca  '});assert.equal(calls[2].payload.role,'Responsable de biblioteca');
 const invalid=service([]);for(const role of ['  ','x'.repeat(101)])await assert.rejects(()=>invalid.service.addProjectMember('p-a',{profile_id:'profile-a',role}),/responsabilidad/);assert.equal(invalid.calls.length,0);
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
