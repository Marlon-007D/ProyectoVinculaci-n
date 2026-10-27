import { AdminForm } from '../auth/AdminForm';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../../core/AuthContext';
import { useTenant } from '../../../core/TenantContext';
import { canonicalTenantRole, canDeleteTenantMember, canAssignTenantRole, canManageTenantMember, isTenantManager, isTenantSuperAdmin } from '../auth/accessPolicy';
import { useToast } from '../auth/Toast/Toast';

import type { TenantAdminService, TenantMember, TenantRequest, TenantSnapshot } from './tenantAdmin.types';
import styles from './UserManagement.module.css';
import { invitationRedirect } from '../auth/tenantUrl';
import { Trash2 } from 'lucide-react';
import { pendingInvitationInput } from './pendingInvitation';

type ScopeState = { key: string; status: 'loading' } | { key: string; status: 'ready'; data: TenantSnapshot } | { key: string; status: 'error'; message: string };
type MemberOperation = 'deactivate' | 'delete';
type Action = { status: 'idle' } | { status: 'saving'; key: string } | { status: 'confirm' | 'removing'; key: string; member: TenantMember; operation: MemberOperation };
const emptyForm = () => ({ email: '', firstName: '', lastName: '', phone: '', roleId: '', modules: [] as string[] });
const labels: Record<string, string> = { super_admin: 'Super Admin de la unidad educativa', institution_admin: 'Administrador de la unidad educativa', teacher: 'Docente', secretary: 'Secretaría', staff: 'Personal', dece: 'Personal DECE', projects_manager: 'Gestor de proyectos', content_editor: 'Editor de contenidos', student: 'Estudiante', guest: 'Invitado', viewer: 'Invitado pendiente', invitado: 'Invitado pendiente', pending: 'Pendiente' };
const roleLabel = (role: string) => labels[canonicalTenantRole(role)] ?? role;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';

export function UserManagement({ service }: { service: TenantAdminService }) {
  const { user, role, institutionId: authInstitutionId, loading: loadingAuth } = useAuth();
  const { activeInstitution, loadingTenant } = useTenant();
  const institutionId = activeInstitution?.institution_id ?? '';
  const actorRole = activeInstitution?.role ?? '';
  const authorized = Boolean(user && institutionId && authInstitutionId === institutionId && role && canonicalTenantRole(role) === canonicalTenantRole(actorRole) && isTenantManager(actorRole));
  const key = `${user?.id ?? ''}:${institutionId}:${actorRole}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const sequence = useRef(0);
  const busyKey = useRef<string | null>(null);
  const [state, setState] = useState<ScopeState>({ status: 'loading', key });
  const [action, setAction] = useState<Action>({ status: 'idle' });
  const [form, setForm] = useState(emptyForm);
  const [approval, setApproval] = useState<TenantRequest | null>(null);
  const [search, setSearch] = useState('');
  const notify = useToast();
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setState({ status: 'loading', key });
    try {
      if (!authorized) throw new Error('No tienes permisos administrativos en la institución activa.');
      const data = await service.load(institutionId);
      if (activeKey.current !== key || request !== sequence.current) return;
      if (canonicalTenantRole(data.actor_role) !== canonicalTenantRole(actorRole)) throw new Error('Tu rol cambió. Vuelve a iniciar sesión.');
      setState({ status: 'ready', key, data });
    } catch (error: unknown) {
      if (activeKey.current !== key || request !== sequence.current) return;
      const message = errorMessage(error);
      setState({ status: 'error', key, message });
      notify(message);
    }
  }, [authorized, institutionId, actorRole, key, notify, service]);
  useEffect(() => {
    setForm(emptyForm()); setApproval(null); setSearch(''); setAction({ status: 'idle' });
    if (!loadingAuth && !loadingTenant) void load();
    return () => { sequence.current++; };
  }, [load, loadingAuth, loadingTenant]);
  if (loadingAuth || loadingTenant || state.key !== key || state.status === 'loading') return <section className={styles.container} role="status" aria-busy="true">Verificando la institución y sus permisos…</section>;
  if (state.status === 'error') return <section className={styles.container}><p>{state.message}</p><button type="button" className={styles.btnSubmit} onClick={() => void load()}>Volver a verificar</button></section>;
  const snapshot = state.data;
  const superAdmin = isTenantSuperAdmin(actorRole);
  const busy = action.status !== 'idle' && action.key === key && action.status !== 'confirm';
  const actor = { profileId: user?.id ?? '', institutionId, role: actorRole };
  const canManage = (member: TenantMember | TenantRequest) => canManageTenantMember(actor, { profileId: member.profile_id, institutionId: member.institution_id, role: 'role_name' in member ? member.role_name : 'pending' });
  const canDelete = (member: TenantMember) => canDeleteTenantMember(actor, { profileId: member.profile_id, institutionId: member.institution_id, role: member.role_name });
  const rows = snapshot.members.filter(member => member.institution_id === institutionId
    && !member.invitation_pending
    && (member.is_active || !['pending', 'guest', 'invitado', 'viewer'].includes(member.role_name))
    && [member.email, member.first_name, member.last_name, roleLabel(member.role_name)].some(value => value.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))));
  function editMember(member: TenantMember | TenantRequest) {
    if (!canManage(member) || busy) return;
    setApproval('request_id' in member ? member : null);
    setForm({ email: member.email, firstName: member.first_name, lastName: member.last_name, phone: member.phone, roleId: '', modules: 'modules' in member ? member.modules : [] });
    document.getElementById('member-role')?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyKey.current === key || !authorized) return;
    const selected = snapshot.roles.find(item => item.role_id === form.roleId);
    if (!selected || !canAssignTenantRole(actorRole, selected.name)) { notify('El rol seleccionado no está permitido para tu cuenta.'); return; }
    if (!form.firstName.trim() || !form.lastName.trim() || !/^09\d{8}$/.test(form.phone)) { notify('Revisa los nombres, apellidos y el celular ecuatoriano.'); return; }
    const modules = form.modules.filter(name => snapshot.modules.includes(name));
    const input = { institutionId, email: form.email.trim().toLowerCase(), roleId: form.roleId, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone, modules };
    busyKey.current = key;
    setAction({ status: 'saving', key });
    try {
      if (approval) {
        await service.approve({ ...input, profileId: approval.profile_id, requestId: approval.request_id });
        if (activeKey.current !== key) return;
        notify('Solicitud aprobada y acceso configurado correctamente.', 'success');
        setState(current => current.key === key && current.status === 'ready' ? { ...current, data: {
          ...current.data,
          requests: current.data.requests.filter(request => request.profile_id !== approval.profile_id),
          members: [...current.data.members.filter(member => member.profile_id !== approval.profile_id), {
            profile_id: approval.profile_id, institution_id: institutionId, email: input.email,
            first_name: input.firstName, last_name: input.lastName, phone: input.phone,
            role_name: selected.name, is_active: true, modules: input.modules, invitation_pending: false,
          }],
        } } : current);
        setApproval(null); setForm(emptyForm());
        return;
      }
      const existing = snapshot.members.find(member => member.email.toLowerCase() === input.email);
      if (existing && !canManage(existing)) throw new Error('No puedes modificar esa cuenta en esta institución.');
      const result = await service.invite({ ...input, redirect_to: invitationRedirect(window.location.origin, activeInstitution!) });
      if (activeKey.current !== key) return;
      if (!result.notificationSent) {
        notify('La invitación quedó pendiente. El correo no se pudo enviar; usa «Reenviar invitación» en la fila de la persona. Si hay un límite de envíos, espera antes de reintentar.', 'warning');
        await load();
        return;
      }
      notify(`Invitación enviada correctamente al correo ${input.email}.`, 'success');
      setForm(emptyForm());
      await load();
    } catch (error: unknown) { if (activeKey.current === key) notify(errorMessage(error)); }
    finally { if (busyKey.current === key) busyKey.current = null; if (activeKey.current === key) setAction({ status: 'idle' }); }
  }
  async function remove(member: TenantMember, operation: MemberOperation) {
    if (busyKey.current === key || !authorized || !(operation === 'delete' ? canDelete(member) : canManage(member))) return;
    busyKey.current = key;
    setAction({ status: 'removing', key, member, operation });
    try {
      if (operation === 'delete') await service.deleteMember(institutionId, member.profile_id);
      else await service.remove(institutionId, member.profile_id);
      if (activeKey.current !== key) return;
      setState(current => current.key === key && current.status === 'ready' ? { ...current, data: {
        ...current.data, members: operation === 'delete' ? current.data.members.filter(item => item.profile_id !== member.profile_id || item.institution_id !== institutionId)
          : current.data.members.map(item => item.profile_id === member.profile_id && item.institution_id === institutionId ? { ...item, is_active: false } : item),
      } } : current);
      const message = operation === 'deactivate' ? 'Rol desactivado en esta institución.' : 'Miembro eliminado correctamente de la Unidad Educativa.';
      notify(message, 'success');
    } catch (error: unknown) { if (activeKey.current === key) notify(errorMessage(error)); }
    finally { if (busyKey.current === key) busyKey.current = null; if (activeKey.current === key) setAction({ status: 'idle' }); }
  }
  async function resend(member: TenantMember) {
    if (busyKey.current === key || !authorized || !canManage(member) || !activeInstitution) return;
    busyKey.current = key;
    setAction({ status: 'saving', key });
    try {
      const input = pendingInvitationInput(snapshot, member, institutionId);
      const result = await service.invite({ ...input, redirect_to: invitationRedirect(window.location.origin, activeInstitution) });
      if (activeKey.current !== key) return;
      notify(result.notificationSent ? `Invitación reenviada correctamente al correo ${input.email}.`
        : 'El acceso sigue pendiente. No se pudo enviar el correo; espera antes de usar «Reenviar invitación» nuevamente.',
      result.notificationSent ? 'success' : 'warning');
    } catch (error: unknown) { if (activeKey.current === key) notify(errorMessage(error)); }
    finally { if (busyKey.current === key) busyKey.current = null; if (activeKey.current === key) setAction({ status: 'idle' }); }
  }
  return <section className={styles.container} aria-labelledby="institution-users-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>SEGURIDAD Y ACCESOS</p><h2 id="institution-users-title">{superAdmin ? 'Administradores de mi institución' : 'Usuarios y roles de mi institución'}</h2><p className={styles.intro}>{superAdmin ? 'Autoriza a los administradores de tu plantel.' : 'Asigna roles internos y los módulos que necesita cada persona.'}</p></div><span className={styles.scopeBadge}>{activeInstitution?.name}</span></header>
    <section className={styles.assignmentCard}><h3>{approval ? 'Aprobar solicitud de registro' : 'Asignar acceso'}</h3><p className={styles.scopeNotice}>Las asignaciones se aplican únicamente a <strong>{activeInstitution?.name}</strong>.</p>
      <AdminForm onSubmit={submit} className={styles.form} aria-busy={busy}>
        <label className={styles.field}>Correo<input className={styles.input} type="email" autoComplete="email" required readOnly={Boolean(approval)} disabled={busy} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label className={styles.field}>Nombres<input className={styles.input} autoComplete="given-name" required disabled={busy} value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></label>
        <label className={styles.field}>Apellidos<input className={styles.input} autoComplete="family-name" required disabled={busy} value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></label>
        <label className={styles.field}>Celular<input className={styles.input} type="tel" autoComplete="tel-national" pattern="09[0-9]{8}" maxLength={10} required disabled={busy} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></label>
        <label className={styles.field} htmlFor="member-role">Rol<select id="member-role" className={styles.select} required disabled={busy} value={form.roleId} onChange={event => setForm({ ...form, roleId: event.target.value, modules: [] })}><option value="">Seleccionar rol</option>{snapshot.roles.filter(item => canAssignTenantRole(actorRole, item.name) && (approval || canonicalTenantRole(item.name) !== 'guest')).map(item => <option key={item.role_id} value={item.role_id}>{roleLabel(item.name)}</option>)}</select></label>
        {(!superAdmin || approval) && <fieldset disabled={busy} className={styles.field}><legend>Módulos asignados</legend>{snapshot.modules.map(name => <label key={name}><input type="checkbox" checked={form.modules.includes(name)} onChange={event => setForm({ ...form, modules: event.target.checked ? [...form.modules, name] : form.modules.filter(item => item !== name) })} /> {name}</label>)}</fieldset>}
        <button className={styles.btnSubmit} disabled={busy} type="submit">{busy ? 'Guardando…' : approval ? 'Aprobar y asignar rol' : 'Asignar acceso'}</button>
        {approval && <button className={styles.btnCancel} type="button" disabled={busy} onClick={() => { setApproval(null); setForm(emptyForm()); }}>Cancelar aprobación</button>}
      </AdminForm>
    </section>
    <section className={styles.membersCard}><div className={styles.membersHeading}><h3>Miembros de {activeInstitution?.name}</h3><label className={styles.field}>Buscar<input className={styles.searchInput} type="search" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Cuenta</th><th>Rol</th><th>Módulos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(member => <tr key={member.profile_id}><td>{member.first_name} {member.last_name}<br />{member.email}</td><td>{roleLabel(member.role_name)}</td><td>{member.modules.join(', ') || 'Sin módulos asignados'}</td><td>{member.is_active ? 'Activo' : 'Inactivo'}</td><td>{canManage(member) && <><button className={styles.btnRemove} type="button" disabled={busy} onClick={() => editMember(member)}>Asignar rol</button><button className={styles.btnRemove} type="button" disabled={busy || !member.is_active} onClick={() => setAction({ status: 'confirm', key, member, operation: 'deactivate' })}>Desactivar rol</button></>}{canDelete(member) && <button className={styles.btnDelete} type="button" disabled={busy} onClick={() => setAction({ status: 'confirm', key, member, operation: 'delete' })}><Trash2 size={16} aria-hidden="true" />Eliminar miembro</button>}</td></tr>)}{!rows.length && <tr><td colSpan={5}>No hay usuarios que coincidan.</td></tr>}</tbody></table></div>
      <h3>Invitaciones pendientes de mi institución</h3><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Cuenta</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{snapshot.members.filter(member => member.institution_id === institutionId && member.invitation_pending).map(member => <tr key={member.profile_id}><td>{member.first_name} {member.last_name}<br />{member.email}</td><td>Invitado · Pendiente de aceptación</td><td><button className={styles.btnRemove} type="button" disabled={busy || !canManage(member)} onClick={() => void resend(member)}>Reenviar invitación</button></td></tr>)}{!snapshot.members.some(member => member.invitation_pending) && <tr><td colSpan={3}>No hay invitaciones pendientes.</td></tr>}</tbody></table></div>
      <h3>Solicitudes de mi institución</h3><button type="button" className={styles.btnRemove} disabled={busy} onClick={() => void load()}>Actualizar solicitudes</button><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Correo</th><th>Nombres</th><th>Apellidos</th><th>Celular</th><th>Acción</th></tr></thead><tbody>{snapshot.requests.filter(request => request.institution_id === institutionId).map(request => <tr key={request.request_id}><td>{request.email}</td><td>{request.first_name}</td><td>{request.last_name}</td><td>{request.phone || 'Por completar'}</td><td><button className={styles.btnRemove} type="button" disabled={busy || !canManage(request)} onClick={() => editMember(request)}>Aprobar y asignar rol</button></td></tr>)}{!snapshot.requests.length && <tr><td colSpan={5}>No hay solicitudes pendientes.</td></tr>}</tbody></table></div>
    </section>
    {(action.status === 'confirm' || action.status === 'removing') && action.key === key && <div className={styles.modalBackdrop}><section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="remove-role-title"><h3 id="remove-role-title">{action.operation === 'delete' ? 'Eliminar miembro' : 'Desactivar rol'}</h3><p>{action.operation === 'delete' ? <>¿Estás seguro de que deseas eliminar a {`${action.member.first_name} ${action.member.last_name}`.trim() || action.member.email} de {activeInstitution?.name}? Esta acción le quitará la membresía a esta institución.</> : <>Se desactivará el rol de {action.member.email} únicamente en {activeInstitution?.name}.</>}</p><div className={styles.modalActions}><button className={styles.btnCancel} type="button" disabled={busy} onClick={() => setAction({ status: 'idle' })}>Cancelar</button><button className={styles.btnConfirmRemove} type="button" disabled={busy} onClick={() => void remove(action.member, action.operation)}>Confirmar</button></div></section></div>}
  </section>;
}
