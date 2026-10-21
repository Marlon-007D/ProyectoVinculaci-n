import {useState, type FormEvent} from 'react';
import {AuthProvider,useAuth} from '../../../core/AuthContext';
import {TenantProvider,useTenant} from '../../../core/TenantContext';
import {MfaEnrollment} from '../../admin/mfa/MfaEnrollment';
import {ProjectsDashboard} from '../ProjectsDashboard';
import {PublicProjects} from '../PublicProjects';
import {PortalEditor} from '../../portal-editor/PortalEditor';
import '../projects.css';

// Local development entry only. Uses the team's existing session and permissions.
function Access(){
  const auth=useAuth();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');
    try{
      const result=auth.mfaRequired?await auth.verifyMfa(String(data.get('code'))):await auth.login(String(data.get('email')).trim(),String(data.get('password')));
      if(result.error)setError(result.error.message);
    }catch{setError('No se pudo iniciar sesión. Vuelve a intentarlo.');}finally{setBusy(false);}
  }
  if(auth.loading)return <p role="status">Comprobando tu sesión…</p>;
  if(auth.mfaEnrollmentRequired)return <MfaEnrollment onEnrolled={auth.completeMfaEnrollment}/>;
  return <section className="project-card access-card"><p className="project-eyebrow">ACCESO INSTITUCIONAL</p><h2>Bienvenido a tu espacio de gestión</h2><p>Inicia sesión para administrar proyectos y el portal de tu institución.</p>
    <form onSubmit={submit}><fieldset disabled={busy} className="project-form-grid" style={{gridTemplateColumns:'1fr'}}>
      {auth.mfaRequired?<label>Código de verificación<input name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required/></label>:<>
        <label>Correo<input name="email" type="email" autoComplete="username" required/></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label>
      </>}
      <button type="submit" disabled={auth.mfaRequired&&!auth.mfaChallengeReady}>{busy?'Comprobando…':'Entrar'}</button>
    </fieldset></form>{error&&<p role="alert" className="project-error">{error}</p>}
  </section>;
}

function Workspace(){
  const auth=useAuth();const tenant=useTenant();
  const [view,setView]=useState<'projects'|'public'|'editor'>(()=>new URLSearchParams(location.search).get('transparency')==='1'?'public':'projects');
  const institution=tenant.activeInstitution;
  const allowed=institution&&tenant.hasModuleAccess(view==='editor'?'portal':'projects');
  function navigate(next:typeof view){
    if(next===view)return;
    const event=new Event('portal-editor-before-leave',{cancelable:true});
    if(!window.dispatchEvent(event)&&!window.confirm('Hay cambios sin guardar. ¿Salir del editor?'))return;
    setView(next);
  }
  return <main className="institutional-workspace">
    <header className="workspace-header"><div><span className="workspace-mark" aria-hidden="true">I</span><div><p className="project-eyebrow">PORTAL INSTITUCIONAL</p><h1>{institution?.name??'Gestión institucional'}</h1></div></div>
      <nav aria-label="Gestión institucional" className="workspace-nav">
        <button aria-current={view==='projects'?'page':undefined} onClick={()=>navigate('projects')}>Proyectos</button>
        <button aria-current={view==='public'?'page':undefined} onClick={()=>navigate('public')}>Transparencia</button>
        <button aria-current={view==='editor'?'page':undefined} onClick={()=>navigate('editor')}>Editor del portal</button>
        {auth.user&&<button onClick={()=>void auth.logout()}>Cerrar sesión</button>}
      </nav>
    </header>
    <div className="workspace-content">{view==='public'?<PublicProjects/>:auth.loading||!auth.user||auth.mfaRequired||auth.mfaEnrollmentRequired?<div className="project-panel"><Access/></div>
      :tenant.loadingTenant?<p role="status">Cargando institución…</p>
      :tenant.tenantError?<div role="alert" className="project-error">{tenant.tenantError}<button onClick={tenant.reloadInstitutions}>Reintentar</button></div>
      :!institution?<p>No tienes una institución asignada.</p>
      :<>
        {view==='projects'&&<label className="project-card">Institución<select value={institution.institution_id} onChange={event=>tenant.setActiveInstitution(tenant.institutions.find(item=>item.institution_id===event.target.value)??null)}>{tenant.institutions.map(item=><option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}</select></label>}
        {!allowed?<p>Este módulo no está habilitado para tu institución.</p>:view==='editor'?<PortalEditor/>
          :!['super_admin','institution_admin','project_manager'].includes(institution.role)?<p>Tu rol no permite gestionar proyectos.</p>
          :<ProjectsDashboard key={`${auth.user.id}:${institution.institution_id}`} institution={institution}/>}
      </>}</div>
  </main>;
}
export function InstitutionalWorkspace(){return <AuthProvider><TenantProvider><Workspace/></TenantProvider></AuthProvider>;}
