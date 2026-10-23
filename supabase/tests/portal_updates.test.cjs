const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

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

function environment(){
 const win=new EventTarget();const doc=new EventTarget();doc.visibilityState='visible';
 const timers=new Map();let next=0;const channels=[];const messages=[];
 win.setInterval=(fn,ms)=>{assert.equal(ms,30000);timers.set(++next,fn);return next;};
 win.clearInterval=id=>timers.delete(id);
 class Channel{constructor(name){this.name=name;channels.push(this);}postMessage(value){messages.push(value);}close(){this.closed=true;}}
 class Custom extends Event{constructor(name,options){super(name);this.detail=options.detail;}}
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('src/modules/site/services/portalUpdates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,window:win,document:doc,BroadcastChannel:Channel,CustomEvent:Custom});
 return {api:exports,win,doc,timers,channels,messages};
}

test('portal refresh is scoped to the institution and ignores hidden tabs',()=>{
 const e=environment();let refreshes=0;
 const stop=e.api.watchPortalUpdates('school-a',()=>refreshes++);
 const channel=e.channels[0];
 channel.onmessage({data:{institutionId:'school-b'}});assert.equal(refreshes,0);
 channel.onmessage({data:{institutionId:'school-a'}});assert.equal(refreshes,1);
 e.doc.visibilityState='hidden';channel.onmessage({data:{institutionId:'school-a'}});
 for(const timer of e.timers.values())timer();assert.equal(refreshes,1);
 e.doc.visibilityState='visible';e.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(refreshes,2);
 e.win.dispatchEvent(new Event('focus'));assert.equal(refreshes,3);
 for(const timer of e.timers.values())timer();assert.equal(refreshes,4);
 stop();assert.equal(e.timers.size,0);assert.equal(channel.closed,true);
 e.win.dispatchEvent(new Event('focus'));e.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(refreshes,4);
});

test('publication invalidation sends no draft content and refreshes the current portal',()=>{
 const e=environment();let refreshes=0;
 const stop=e.api.watchPortalUpdates('school-a',()=>refreshes++);
 e.api.notifyPortalPublished('school-a');assert.equal(refreshes,1);
 assert.equal(JSON.stringify(e.messages),JSON.stringify([{institutionId:'school-a'}]));
 assert.equal(e.channels[1].closed,true);stop();
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
