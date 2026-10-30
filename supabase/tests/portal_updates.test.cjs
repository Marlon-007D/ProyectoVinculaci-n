const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

const {portalHookHarness}=require('./fixtures/portalHookHarness.cjs');

test('public content stays stable on idle, focus, storage and publication; manual retry and navigation still load',async()=>{
 const h=portalHookHarness();let tenant='school-a',revision=1,fail=false;const calls=[];
 const services=Object.fromEntries(['getNews','getEvents','getHonors','getStaff'].map(name=>[name,async institution=>{
  calls.push({name,institution});if(fail)throw new Error('offline');return [{institution,revision}];
 }]));
 const asyncHooks=h.load('src/modules/site/hooks/useAsync.ts');
 const hooks=h.load('src/modules/site/hooks/useContent.ts',{
  './useAsync':asyncHooks,'../context/InstitutionContext':{useInstitution:()=>({institutionId:tenant})},'../services/content':services,
 });
 h.render(()=>[hooks.useNews(),hooks.useEvents(),hooks.useHonors(),hooks.useStaff()]);
 const initial=await h.flush();assert.equal(calls.length,4);
 assert.ok(initial.every(item=>item.state.status==='success'&&item.state.data[0].revision===1));
 revision=2;h.idle();const unchanged=await h.flush();
 assert.equal(h.timers.size,0);assert.equal(h.channels.length,0);assert.equal(calls.length,4);
 unchanged.forEach((item,i)=>assert.equal(item.state,initial[i].state));
 unchanged[0].reload();assert.equal(h.render()[0].state.status,'loading');
 let result=await h.flush();assert.equal(calls.length,5);assert.equal(result[0].state.data[0].revision,2);
 fail=true;result[0].reload();h.render();result=await h.flush();assert.equal(result[0].state.status,'error');
 const beforeIdle=calls.length;h.idle();await h.flush();assert.equal(calls.length,beforeIdle);
 fail=false;result[0].reload();h.render();result=await h.flush();assert.equal(result[0].state.status,'success');
 tenant='school-b';h.render();result=await h.flush();
 assert.ok(result.every(item=>item.state.data[0].institution==='school-b'));h.stop();
});

test('transparency requests only the visible page; typing, idling and timers never query',async()=>{
 const h=portalHookHarness();const calls=[];
 const money=h.load('src/modules/projects/projectValidation.ts');
 const presentation=h.load('src/modules/projects/projectPresentation.ts',{'./projectValidation':money});
 const transparency=h.load('src/modules/projects/publicTransparency.ts',{'./projectPresentation':presentation,'./projectValidation':money});
 const {PublicProjects}=h.load('src/modules/projects/PublicProjects.tsx',{
  '../../core/supabase/publicClient':{publicSupabase:{}},
  './projectValidation':money,'./projectPresentation':presentation,'./publicTransparency':transparency,
  './PublicProjects.module.css':{default:{}},
  './TransparencyReportActions':{TransparencyReportActions:()=>null},
  '../../shared/components/Toaster/notify':{notify:{}},
 });
 const row={project_id:'garden',title:'Huerto escolar',description:'Materiales',is_active:true,total_budget:120,spent:30,balance:90};
 const source={institutions:async()=>[],page:async query=>{calls.push(query);return {total:12,rows:[row],summary:{count:12,budget:1200,spent:300,active:8,closed:4}};}};
 function find(node,predicate){
  if(!node||typeof node!=='object')return undefined;
  if(predicate(node))return node;
  for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}
 }
 const text=node=>[node.props.children].flat(Infinity).filter(item=>typeof item==='string').join('');
 const button=(tree,label)=>find(tree,node=>node.type==='button'&&(node.props['aria-label']===label||text(node).includes(label)));
 h.render(()=>PublicProjects({institutionSlug:'school-a',institutionName:'Colegio',source}));
 let tree=await h.flush();
 assert.equal(calls.length,1);assert.equal(JSON.stringify(calls[0]),JSON.stringify({slug:'school-a',search:'',status:'all',sort:'name',page:1,pageSize:9}));
 find(tree,node=>node.type==='input'&&node.props.type==='search').props.onChange({target:{value:'Huerto'}});tree=h.render();
 h.idle();tree=await h.flush();assert.equal(calls.length,1);assert.equal(h.timers.size,0);assert.equal(h.channels.length,0);
 find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});h.render();tree=await h.flush();
 assert.equal(calls.length,2);assert.equal(calls[1].search,'Huerto');
 button(tree,'Página siguiente').props.onClick();h.render();tree=await h.flush();
 assert.equal(calls.length,3);assert.equal(calls[2].page,2);
 button(tree,'Cerrados').props.onClick();h.render();tree=await h.flush();
 assert.equal(calls.length,4);assert.equal(calls[3].status,'closed');assert.equal(calls[3].page,1);
 button(tree,'Actualizar').props.onClick();h.render();tree=await h.flush();
 assert.equal(calls.length,5);assert.equal(JSON.stringify({...calls[4]}),JSON.stringify({...calls[3]}));
 assert.equal(find(tree,node=>node.type==='input'&&node.props.type==='search').props.value,'Huerto');
 h.stop();
});

test('all four institutions share the same immutable header routes and hierarchy',()=>{
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/site/utils/institutionalNavigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 const trees=['ue-el-esfuerzo','ue-la-concordia','ue-luz-de-america','ue-puerto-limon'].map(id=>exports.institutionalNavigation(id));
 const shape=tree=>JSON.stringify(tree.map(({label,url,children})=>({label,url,children:children.map(({label,url})=>({label,url}))})));
 for(const tree of trees)assert.equal(shape(tree),shape(trees[0]));
 assert.deepEqual(Array.from(trees[0],node=>node.label),['Inicio','Institución','Noticias','Contacto','Simuladores','Transparencia','DECE']);
 assert.deepEqual(Array.from(trees[0][1].children,node=>node.label),['Nosotros','Oferta educativa']);
 trees[0][1].children[0].label='Cambio local';
 assert.equal(exports.institutionalNavigation()[1].children[0].label,'Nosotros');
 const header=fs.readFileSync('src/modules/site/components/Header/Header.tsx','utf8');
 assert.match(header,/const tree = institutionalNavigation/);
 assert.doesNotMatch(header,/menu\.state/);
 const editor=fs.readFileSync('src/modules/portal-editor/PortalEditor.tsx','utf8');
 assert.doesNotMatch(editor,/moveMenu|Quitar enlace|Añadir enlace/);
});

test('menu hierarchy survives ordering and removal without flattening or cycles',()=>{
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/portal-editor/portalMenus.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 const menus=[{id:'child',parent_id:'parent',label:'Historia',url:'/?slug=historia'},{id:'parent',label:'Institución',url:'/'},{id:'grandchild',parent_id:'child',label:'Equipo',url:'/?slug=equipo'}];
 assert.equal(exports.validateMenuHierarchy(menus)[0].parent_id,'parent');
 assert.equal(exports.removeMenu(menus,0).find(m=>m.id==='grandchild').parent_id,'parent');
 assert.equal(exports.removeMenu(menus,1).find(m=>m.id==='child').parent_id,null);
 assert.throws(()=>exports.validateMenuHierarchy([menus[0],{...menus[1],parent_id:'child'}]),/grupos/);
 assert.throws(()=>exports.validateMenuHierarchy([{...menus[0],parent_id:'other'}]),/grupos/);
 assert.throws(()=>exports.validateMenuHierarchy([menus[1],menus[1]]),/duplicados/);
});

test('published pages reuse current portal identity; private drafts retain their edits in all four institutions',()=>{
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/portal-editor/contract.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 for(let index=1;index<=4;index++){
  const current=exports.newSnapshot(`Institución ${index}`);
  current.settings.contact_email=`contacto${index}@example.test`;
  current.menus=[{id:'parent',label:'Institución',url:'/'},{id:'child',parent_id:'parent',label:'Historia',url:'/?slug=historia'}];
  const page={...exports.newSnapshot('Identidad anterior'),title:'Contacto',slug:'contacto',publication_state:'published'};
  const hydrated=exports.withCurrentIdentity(page,current);
  assert.equal(hydrated.settings.contact_email,current.settings.contact_email);
  assert.equal(hydrated.settings.site_title,current.settings.site_title);
  assert.equal(hydrated.title,'Contacto');
  assert.equal(hydrated.menus[1].parent_id,'parent');
  const draft=exports.withCurrentIdentity({...page,publication_state:'draft'},current);
  assert.equal(draft.settings.site_title,'Identidad anterior');
 }
 const snapshot=exports.newSnapshot('Institución');
 snapshot.sections=[{id:'links',type:'links',position:0,is_visible:true,properties:{url:'/old',items:[{title:'Nuevo',url:'/new'},{title:'Otro',url:'/other'}]}}];
 assert.equal(exports.normalizeSnapshot(snapshot).sections[0].properties.items.length,2);
});

test('preview fills the desktop panel and scales the iframe exactly once',()=>{
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/portal-editor/previewViewport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 for(const available of [280,390,680,1024,1500]){
  const desktop=exports.previewViewport('desktop',available);
  assert.equal(desktop.visibleWidth,available);
  assert.ok(desktop.width>=1280);
  assert.ok(Math.abs(desktop.height*desktop.scale-desktop.visibleHeight)<1);
  const mobile=exports.previewViewport('mobile',available);
  assert.equal(mobile.width,390);
  assert.equal(mobile.visibleWidth,Math.min(390,available));
  assert.ok(Math.abs(mobile.height*mobile.scale-mobile.visibleHeight)<1);
 }
 // The shared .site-root iframe max-width must not shrink the viewport before scaling.
 assert.match(fs.readFileSync('src/modules/portal-editor/PortalPreviewFrame.tsx','utf8'),/maxWidth: 'none'/);
});

const selection={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/modules/portal-editor/portalSelection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:selection});
test('editor opens the existing homepage and preserves its ID and revision on reload',()=>{
 const other={page_id:'other',revision:2,snapshot:{title:'Historia',slug:'historia',is_homepage:false}};
 const home={page_id:'home',revision:7,snapshot:{title:'Inicio',slug:'inicio',is_homepage:true},published_slug:'inicio'};
 assert.equal(selection.initialPortalPage([other,home]),home);
 assert.equal(selection.initialPortalPage([other,home],'other'),other);
 assert.equal(selection.initialPortalPage([other,home],'removed'),home);
 assert.equal(selection.initialPortalPage([]),null);
 assert.equal(selection.conflictingPortalPage([other,home],null,'inicio'),home);
 assert.equal(selection.conflictingPortalPage([other,home],'home','inicio'),undefined);
 assert.equal(selection.conflictingPortalPage([other,{...home,snapshot:{...home.snapshot,slug:'nueva-portada'}}],'other','inicio').page_id,'home');
});
test('duplicate errors distinguish a page address from an unexpected database constraint',()=>{
 assert.match(selection.portalDuplicateMessage({code:'23505',message:'duplicate key value violates unique constraint "unique_institution_page_slug"'}),/Ya existe una página/);
 assert.match(selection.portalDuplicateMessage({code:'23505',message:'duplicate key value violates unique constraint "unique_page_version"'}),/unique_page_version/);
 assert.equal(selection.portalDuplicateMessage({code:'42501'}),undefined);
});

test('background refresh keeps published content and cancels stale institution responses',async()=>{
 const slots=[];let cursor=0;let pending=[];let dirty=false;let output;let tenant='school-a';
 const same=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={
  useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;dirty=true;}];},
  useCallback(fn,deps){const index=cursor++;if(!same(slots[index]?.deps,deps))slots[index]={deps,fn};return slots[index].fn;},
  useEffect(fn,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){pending.push(()=>{slots[index]?.cleanup?.();slots[index]={deps,cleanup:fn()};});}},
 };
 const exports={};const requests=[];
 const code=ts.transpileModule(fs.readFileSync('src/modules/site/hooks/useAsync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{assert.equal(name,'react');return react;}});
 const load=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
 const render=()=>{do{dirty=false;cursor=0;output=exports.useAsync(load,[tenant]);const effects=pending;pending=[];effects.forEach(fn=>fn());}while(dirty);};
 const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));render();};
 render();assert.equal(output.state.status,'loading');
 requests[0].resolve('published-a');await flush();assert.equal(output.state.data,'published-a');
 output.refresh();render();assert.equal(output.state.data,'published-a');
 requests[1].reject(new Error('offline'));await flush();assert.equal(output.state.data,'published-a');
 output.refresh();render();tenant='school-b';render();assert.equal(output.state.status,'loading');
 requests[2].resolve('outdated-a');await flush();assert.equal(output.state.status,'loading');
 requests[3].resolve('published-b');await flush();assert.equal(output.state.data,'published-b');
 output.reload();render();assert.equal(output.state.status,'loading');
 requests[4].resolve('updated-b');await flush();assert.equal(output.state.data,'updated-b');
 slots.forEach(slot=>slot?.cleanup?.());
});

test('after the first load a re-render, a publication notice or a dependency change never bring the skeleton back; reload still does',async()=>{
 const h=portalHookHarness();let tenant='school-a';const calls=[];
 const services={getNews:async institution=>{calls.push(institution);return [{institution}];},getEvents:async()=>[],getHonors:async()=>[],getStaff:async()=>[]};
 const asyncHooks=h.load('src/modules/site/hooks/useAsync.ts');
 const hooks=h.load('src/modules/site/hooks/useContent.ts',{'./useAsync':asyncHooks,'../context/InstitutionContext':{useInstitution:()=>({institutionId:tenant})},'../services/content':services});
 h.render(()=>hooks.useNews());
 assert.equal(h.render().state.status,'loading','the very first load shows the skeleton');
 let result=await h.flush();assert.equal(result.state.status,'success');
 const loaded=result.state;
 assert.equal(h.render().state,loaded,'a plain re-render keeps the same content');
 h.idle();assert.equal((await h.flush()).state,loaded,'idle, focus or a publication notice do not refetch or flash');
 assert.equal(calls.length,1);
 tenant='school-b';
 const during=h.render();
 assert.equal(during.state.status,'success','changing the inputs keeps the previous content on screen');
 assert.equal(during.state.data[0].institution,'school-a');
 result=await h.flush();assert.equal(result.state.data[0].institution,'school-b');assert.equal(calls.length,2);
 result.reload();assert.equal(h.render().state.status,'loading','an explicit reload still shows the loading state');
 h.stop();
});
