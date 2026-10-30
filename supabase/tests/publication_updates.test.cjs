const {test}=require('node:test');
const assert=require('node:assert/strict');
const {portalHookHarness}=require('./fixtures/portalHookHarness.cjs');

test('publication events are scoped, deduplicated and recovered on reconnect without polling',async()=>{
 const h=portalHookHarness();
 const {createPublicationUpdates}=h.load('src/modules/site/services/publicationUpdates.ts');
 let event,status,reads=0,removed=0,revision=1,notices=0;
 const channel={on(kind,filter,fn){assert.equal(kind,'postgres_changes');assert.equal(filter.filter,'institution_id=eq.school-a');event=fn;return this;},subscribe(fn){status=fn;return this;}};
 const client={channel:()=>channel,removeChannel:()=>{removed++;},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{reads++;return {data:{revision},error:null};}})})})};
 const stop=createPublicationUpdates(client).subscribe('school-a',()=>notices++);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 status('SUBSCRIBED');await flush();assert.equal(reads,1);assert.equal(notices,0);
 event({new:{institution_id:'school-b',revision:2}});assert.equal(notices,0);
 event({new:{institution_id:'school-a',revision:2}});assert.equal(notices,1);
 event({new:{institution_id:'school-a',revision:2}});assert.equal(notices,1);
 revision=3;status('SUBSCRIBED');await flush();assert.equal(notices,2);assert.equal(reads,2);
 assert.equal(h.timers.size,0);
 stop();event({new:{institution_id:'school-a',revision:4}});status('SUBSCRIBED');await flush();
 assert.equal(removed,1);assert.equal(reads,2);assert.equal(notices,2);
});

test('notice never reloads automatically and closes its subscription on institution change',()=>{
 const h=portalHookHarness();let publish,cleanups=0,tenant='school-a',reloads=0;const shown=[],dismissed=[];
 h.window.location={reload:()=>reloads++};
 const updates={subscribe(id,fn){publish=fn;return()=>cleanups++;}};
 const notifier={info:(title,options)=>shown.push({title,...options}),dismiss:id=>dismissed.push(id)};
 const {PublicationNotice}=h.load('src/modules/site/components/PublicationNotice/PublicationNotice.tsx',{
  '../../../../shared/components/Toaster/notify':{notify:notifier},
 });
 assert.equal(h.render(()=>PublicationNotice({institutionId:tenant,updates,notifier})),null);
 assert.equal(shown.length,0);
 publish();publish();h.render();assert.equal(reloads,0);
 // Same id: a repeated publication replaces the visible notice instead of stacking.
 assert.deepEqual(shown.map(item=>item.id),['publication:school-a','publication:school-a']);
 assert.equal(shown[0].persistent,true);assert.equal(shown[0].action.label,'Recargar página');
 shown[0].action.onClick();assert.equal(reloads,1);
 tenant='school-b';assert.equal(h.render(),null);assert.equal(cleanups,1);assert.deepEqual(dismissed,['publication:school-a']);
 h.stop();assert.equal(cleanups,2);assert.deepEqual(dismissed,['publication:school-a','publication:school-b']);
});
