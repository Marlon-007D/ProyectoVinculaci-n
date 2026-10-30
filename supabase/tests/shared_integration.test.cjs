const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const jsx=require('react/jsx-runtime');
const {renderToStaticMarkup}=require('react-dom/server');
function load(path,imports={}) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,URLSearchParams,require:name=>{if(name in imports)return imports[name];if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;throw new Error('Unexpected import '+name);}});
  return exports;
}
const roles=load('src/core/auth/institutionalRoles.ts');
const style=new Proxy({},{get:(_,key)=>String(key)});
function workspace({user=true,role='projects_manager',enabled=true,mode='projects',error=null,mfa=false,tenantLoading=false}={}) {
  const institution={institution_id:'tenant-a',slug:'el-esfuerzo',name:'El Esfuerzo',role};
  const {ProjectsWorkspace}=load('src/modules/projects/ProjectsWorkspace.tsx',{
    'react-router-dom':{useLocation:()=>({pathname:'/panel/'+(mode==='portal'?'portal':'proyectos'),search:'?institution=tenant-a'}),Navigate:props=>React.createElement('p',null,'REDIRECT '+props.to+' RETURN '+JSON.stringify(props.state))},
    '../../core/AuthContext':{useAuth:()=>({user:user?{id:'verified-user'}:null,role,loading:false,mfaRequired:mfa,logout:async()=>{}})},
    '../../core/TenantContext':{useTenant:()=>({activeInstitution:institution,institutions:[institution],loadingTenant:tenantLoading,tenantError:error,hasModuleAccess:()=>enabled,reloadInstitutions:()=>{}})},
    '../../core/auth/institutionalRoles':roles,
    '../site/components/Layout/PrivateWorkspace':{PrivateWorkspace:({children})=>React.createElement('div',null,React.createElement('aside',null,'SHARED SIDEBAR'),children)},
    '../site/components/Layout/InstitutionSessionLayout':{InstitutionSessionLayout:({children})=>React.createElement('div',null,'SHARED FRAME',children)},
    '../site/context/InstitutionContext':{InstitutionProvider:({children})=>children},
    '../admin/AdminRoutes.module.css':{__esModule:true,default:style},
    './ProjectsDashboard':{ProjectsDashboard:({institution})=>React.createElement('p',null,'PROJECTS '+institution.institution_id)},
    '../portal-editor/PortalEditor':{PortalEditor:()=>React.createElement('p',null,'SHARED TENANT EDITOR')},
    './projectStyles':{moduleClass:value=>value},
    './InstitutionSwitcher':{useProjectInstitutionSync:()=>{}},
  });
  return renderToStaticMarkup(React.createElement(ProjectsWorkspace,{mode}));
}
test('anonymous project and editor entries return to the shared login, never a second form',()=>{
  for(const mode of ['projects','portal']) {const html=workspace({user:false,mode});assert.match(html,/REDIRECT \/login\?institution=tenant-a/);assert.match(html,/returnTo/);assert.ok(!html.includes('<form'));}
});
test('shared password session reaches projects without a second MFA challenge',()=>{
  const html=workspace();assert.match(html,/SHARED FRAME/);assert.match(html,/SHARED SIDEBAR/);assert.match(html,/PROJECTS tenant-a/);assert.doesNotMatch(html,/Código de verificación|one-time-code|<form/);
});
test('both team role names work; revoked roles and disabled modules never mount private content',()=>{
  for(const role of ['projects_manager','project_manager','institution_admin','super_admin']) assert.match(workspace({role}),/PROJECTS tenant-a/);
  for(const role of ['editor','content_editor']) assert.match(workspace({role,mode:'portal'}),/SHARED TENANT EDITOR/);
  for(const role of ['student','viewer','pending','dece']) assert.doesNotMatch(workspace({role}),/PROJECTS tenant-a/);
  assert.doesNotMatch(workspace({role:'projects_manager',mode:'portal'}),/SHARED TENANT EDITOR/);
  assert.doesNotMatch(workspace({enabled:false}),/PROJECTS tenant-a/);
});
test('shared authentication or tenant errors never display project data',()=>{
  assert.match(workspace({mfa:true}),/REDIRECT \/panel\/admin/);
  assert.doesNotMatch(workspace({error:'Backend unavailable'}),/PROJECTS tenant-a/);
  assert.doesNotMatch(workspace({tenantLoading:true}),/PROJECTS tenant-a/);
});
test('old published links land in the team portal with the same institution and page',()=>{
  const {default:ModuleRoutes}=load('src/modules/projects/integration/ModuleRoutes.tsx',{
    'react-router-dom':{useLocation:()=>({pathname:'/portal'}),useSearchParams:()=>[new URLSearchParams('institution=el-esfuerzo&page=historia')],Navigate:({to})=>React.createElement('p',null,to)},
    '../ProjectsWorkspace':{},'../PublicProjects':{},'../../site/context/InstitutionContext':{},'../../site/components/Layout/SiteLayout':{},
  });
  const html=renderToStaticMarkup(React.createElement(ModuleRoutes));assert.match(html,/institution=el-esfuerzo/);assert.match(html,/slug=historia/);assert.doesNotMatch(html,/page=/);
});
