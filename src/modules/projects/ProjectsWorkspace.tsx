import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ProjectsDashboard} from './ProjectsDashboard';
import {PortalEditor} from '../portal-editor/PortalEditor';
import {ModuleSessionProvider,useTenant} from './integration/ModuleSession';
import {moduleAccess} from './integration/sessionPort';
import {moduleClass as css} from './projectStyles';

function AccessForm(){
  const access=useTenant();const mfa=access.state.kind==='mfa';
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);if(mfa)void access.verify(String(data.get('code')));else void access.login(String(data.get('email')).trim(),String(data.get('password')));}
  return <section className={css('project-card access-card')}><p className={css('project-eyebrow')}>ACCESO INSTITUCIONAL</p><h1>{mfa?'Verifica tu identidad':'Gestión institucional'}</h1><p>{mfa?'Introduce el código de tu aplicación de autenticación.':'Accede con una cuenta institucional existente.'}</p><form onSubmit={submit}><fieldset disabled={access.busy} className={css('project-form-grid')}>
    {mfa?<label className={css('project-wide')}>Código de verificación<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required/></label>:<><label className={css('project-wide')}>Correo<input name="email" type="email" autoComplete="username" required/></label><label className={css('project-wide')}>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label></>}
    <button type="submit" className={css('project-wide')}>{access.busy?'Comprobando…':mfa?'Verificar':'Entrar'}</button></fieldset></form>
    {mfa&&<button disabled={access.busy} onClick={()=>void access.logout()}>Usar otra cuenta</button>}
  </section>;
}
function Content({mode}:{mode:'projects'|'portal'}){
  const access=useTenant();const institution=access.activeInstitution;
  switch(access.state.kind){
    case 'checking':return <p role="status">Comprobando acceso institucional…</p>;
    case 'signed-out':case 'mfa':return <AccessForm/>;
    case 'unavailable':return <section className={css('project-card')}><h1>Acceso pendiente de verificar</h1><p role="alert">{access.state.message}</p><button onClick={access.reload}>Reintentar</button></section>;
    case 'ready':{
      if(!institution)return <section className={css('project-card')}><h1>Sin institución asignada</h1><p>Solicita que el responsable de accesos revise tu membresía.</p></section>;
      if(institution.module_permissions[mode]!==true)return <p>Este módulo no está habilitado para tu institución.</p>;
      if(mode==='portal')return <PortalEditor/>;
      if(!['super_admin','institution_admin','project_manager'].includes(institution.role))return <p>Tu rol no permite gestionar proyectos.</p>;
      return <><label className={css('project-card')}>Institución<select value={institution.institution_id} onChange={event=>access.setActiveInstitution(access.institutions.find(item=>item.institution_id===event.target.value)??null)}>{access.institutions.map(item=><option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}</select></label><ProjectsDashboard key={`${access.state.userId}:${institution.institution_id}`} institution={institution}/></>;
    }
  }
}
function Workspace({mode}:{mode:'projects'|'portal'}){
  const access=useTenant();
  function allowLeave(){const event=new Event('portal-editor-before-leave',{cancelable:true});return window.dispatchEvent(event)||window.confirm('Hay cambios sin guardar. ¿Salir del editor?');}
  return <main className={css('institutional-workspace')}><header className={css('workspace-header')}><h1>Gestión institucional</h1><nav className={css('workspace-nav')} aria-label="Gestión institucional">{[['/','Portal público'],['/panel/proyectos','Proyectos'],['/proyectos?transparency=1','Transparencia'],['/panel/portal','Editor del portal']].map(([to,label])=><Link key={to} to={to} onClick={event=>{if(!allowLeave())event.preventDefault();}}>{label}</Link>)}{access.state.kind!=='signed-out'&&access.state.kind!=='checking'&&<button disabled={access.busy} onClick={()=>{if(allowLeave())void access.logout();}}>Cerrar sesión</button>}</nav></header><div className={css('workspace-content project-panel')}>{access.message&&<p role="alert" className={css('project-error')}>{access.message}</p>}<Content mode={mode}/></div></main>;
}
export function ProjectsWorkspace({mode='projects'}:{mode?:'projects'|'portal'}){
  // Clear local editing state when the route changes; session identity stays server-verified.
  const [key,setKey]=useState(0);useEffect(()=>{const update=()=>setKey(value=>value+1);window.addEventListener('projects-institutions-changed',update);return()=>window.removeEventListener('projects-institutions-changed',update);},[]);
  return <ModuleSessionProvider key={key} port={moduleAccess}><Workspace key={mode} mode={mode}/></ModuleSessionProvider>;
}
