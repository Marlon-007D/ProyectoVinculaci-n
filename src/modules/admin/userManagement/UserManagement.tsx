import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { useAuth } from '../../../core/AuthContext';
import { logAuditEvent } from '../../../core/auditLogger';
import styles from './UserManagement.module.css';

interface InstitutionOption { institution_id: string; name: string }
interface RoleOption { role_id: string; name: string }
interface UserMember { profile_id: string; institution_id: string; email: string; role: string; roleName: string; institution: string }

const roleLabels: Record<string, string> = {
  super_admin: 'Superadministrador global',
  institution_admin: 'Administrador institucional',
  dece_staff: 'Equipo DECE',
  project_manager: 'Gestor de proyectos',
  editor: 'Editor de contenidos',
  viewer: 'Consulta',
};
const formatRole = (role: string) => roleLabels[role] ?? role.replaceAll('_', ' ');

export const UserManagement: React.FC = () => {
  const { role: currentRole, institutionId: currentInstitutionId } = useAuth();
  const isPlatformAdmin = currentRole === 'super_admin';
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<UserMember | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [institutionResult, roleResult, membershipResult] = await Promise.all([
      supabase.from('institutions').select('institution_id, name').eq('is_active', true).order('name'),
      supabase.from('roles').select('role_id, name').order('name'),
      supabase.from('memberships')
        .select('profile_id, institution_id, profiles!fk_memberships_profile(email), roles!fk_memberships_role(name), institutions!fk_memberships_institution(name)')
        .order('profile_id'),
    ]);
    const failure = institutionResult.error ?? roleResult.error ?? membershipResult.error;
    if (failure) {
      setLoadError(`No se pudieron cargar los usuarios y roles: ${failure.message}`);
      setLoading(false);
      return;
    }

    const visibleInstitutions = institutionResult.data ?? [];
    const scopedInstitutions = isPlatformAdmin
      ? visibleInstitutions
      : visibleInstitutions.filter((item) => item.institution_id === currentInstitutionId);
    setInstitutions(scopedInstitutions);
    if (isPlatformAdmin) {
      setInstitutionId((current) => scopedInstitutions.some((item) => item.institution_id === current) ? current : '');
    } else {
      setInstitutionId(currentInstitutionId ?? '');
    }
    setRoles(roleResult.data ?? []);
    const rows = (membershipResult.data ?? []) as unknown as {
      profile_id: string;
      institution_id: string;
      profiles: { email: string } | null;
      roles: { name: string } | null;
      institutions: { name: string } | null;
    }[];
    setMembers(rows.map((row) => ({
      profile_id: row.profile_id,
      institution_id: row.institution_id,
      email: row.profiles?.email ?? 'Correo no disponible',
      roleName: row.roles?.name ?? 'unknown',
      role: formatRole(row.roles?.name ?? 'Rol desconocido'),
      institution: row.roles?.name === 'super_admin'
        ? 'Alcance global (todas las instituciones)'
        : row.institutions?.name ?? 'Institución desconocida',
    })));
    setLoadError('');
    setLoading(false);
  }, [isPlatformAdmin, currentInstitutionId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleAssignUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg('');
    const normalizedEmail = email.trim().toLowerCase();
    const selectedRole = roles.find((item) => item.role_id === roleId);
    if (!institutionId || !selectedRole) {
      setMsg('Selecciona la institución y el rol que vas a asignar.');
      return;
    }
    if (selectedRole.name === 'super_admin') {
      setMsg('El superadministrador global solo se habilita mediante el alta inicial segura.');
      return;
    }
    if (!isPlatformAdmin && institutionId !== currentInstitutionId) {
      setMsg('Solo puedes asignar permisos dentro de tu institución.');
      return;
    }

    const { error } = await supabase.rpc('assign_institution_role', {
      target_email: normalizedEmail,
      target_role_id: roleId,
      target_institution_id: institutionId,
    });
    if (error) {
      const missingAccount = error.message.includes('No existe una cuenta registrada');
      if (missingAccount && isPlatformAdmin) {
        const { data, error: inviteError } = await supabase.functions.invoke('invite-institution-user', {
          body: { email: normalizedEmail, roleId, institutionId },
        });
        if (inviteError) {
          const details = typeof inviteError.context?.json === 'function'
            ? await inviteError.context.json().catch(() => null)
            : null;
          setMsg(details?.error ?? `No se pudo enviar la invitación: ${inviteError.message}. Verifica que la función invite-institution-user esté desplegada en Supabase.`);
          return;
        }
        await logAuditEvent({ action: 'INVITE_AND_ASSIGN_ROLE', entity: 'memberships', details: { email: normalizedEmail, roleId, institutionId }, institutionId });
        setMsg(data?.message ?? 'Invitación enviada y rol asignado. La persona recibirá un correo para activar su cuenta.');
        setEmail('');
        await loadData();
        return;
      }
      setMsg(missingAccount
        ? 'La cuenta todavía no existe. Solicita al superadministrador global que envíe la invitación.'
        : `No se pudo asignar el rol: ${error.message}`);
      return;
    }
    await logAuditEvent({ action: 'ASSIGN_ROLE', entity: 'memberships', details: { email: normalizedEmail, roleId, institutionId }, institutionId });
    setMsg('Rol asignado correctamente a la institución.');
    setEmail('');
    await loadData();
  };

  const handleRemoveRole = (member: UserMember) => setPendingRemoval(member);

  const confirmRemoveRole = async () => {
    if (!pendingRemoval) return;
    const member = pendingRemoval;
    const key = `${member.profile_id}-${member.institution_id}`;
    setRemovingKey(key);
    setMsg('');
    const { error } = await supabase.rpc('remove_institution_role', {
      target_institution_id: member.institution_id,
      target_profile_id: member.profile_id,
    });
    setRemovingKey('');
    if (error) {
      setMsg(`No se pudo quitar el rol: ${error.message}`);
      return;
    }
    setPendingRemoval(null);
    await logAuditEvent({ action: 'REMOVE_ROLE', entity: 'memberships', details: { email: member.email, role: member.roleName }, institutionId: member.institution_id });
    setMsg(`Se quitó el rol de ${member.email} en ${member.institution}.`);
    await loadData();
  };

  return (
    <div className={styles.container}>
      <h2>Usuarios y roles</h2>
      <p>{isPlatformAdmin
        ? 'Asigna administradores y permisos para una institución específica. El superadministrador global puede gestionar las cuatro unidades educativas.'
        : 'Gestiona los permisos de las cuentas de tu institución. Las demás unidades educativas no aparecen aquí.'}</p>
      <p className={styles.roleGuide}>{isPlatformAdmin
        ? 'Escribe el correo y asigna el rol. Si la cuenta aún no existe, se enviará una invitación para activarla; si ya existe, el rol se asignará de inmediato.'
        : 'La cuenta debe existir antes de asignar permisos. Si todavía no existe, solicita al superadministrador global que envíe una invitación.'}</p>
      {loadError && <p role="alert">{loadError}</p>}
      <form onSubmit={handleAssignUser} className={styles.form}>
        <label className={styles.field} htmlFor="member-email">Correo de la cuenta
          <input id="member-email" type="email" placeholder="persona@institucion.edu.ec" value={email} onChange={(event) => setEmail(event.target.value)} required className={styles.input} />
        </label>
        <label className={styles.field} htmlFor="member-role">Rol
          <select id="member-role" value={roleId} onChange={(event) => setRoleId(event.target.value)} required className={styles.select}>
            <option value="">Seleccionar rol</option>
            {roles.filter((item) => item.name !== 'super_admin').map((item) => <option key={item.role_id} value={item.role_id}>{formatRole(item.name)}</option>)}
          </select>
        </label>
        <label className={styles.field} htmlFor="member-institution">Institución
          <select id="member-institution" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} required disabled={!isPlatformAdmin} className={styles.select}>
            <option value="">Seleccionar institución</option>
            {institutions.map((institution) => <option key={institution.institution_id} value={institution.institution_id}>{institution.name}</option>)}
          </select>
        </label>
        <button type="submit" className={styles.btnSubmit}>Asignar rol</button>
      </form>
      {msg && <p role="status">{msg}</p>}
      {pendingRemoval && <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget && !removingKey) setPendingRemoval(null); }}>
        <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="remove-role-title" aria-describedby="remove-role-description">
          <span className={styles.modalEyebrow}>CONFIRMAR CAMBIO DE ACCESO</span>
          <h3 id="remove-role-title">¿Quitar este rol?</h3>
          <p id="remove-role-description">Se quitará el rol <strong>{pendingRemoval.role}</strong> de <strong>{pendingRemoval.email}</strong> en {pendingRemoval.institution}. La cuenta de autenticación no se eliminará.</p>
          {msg && <p role="alert" className={styles.modalError}>{msg}</p>}
          <div className={styles.modalActions}>
            <button type="button" disabled={Boolean(removingKey)} onClick={() => { setPendingRemoval(null); setMsg(''); }} className={styles.btnCancel}>Cancelar</button>
            <button type="button" disabled={Boolean(removingKey)} onClick={() => void confirmRemoveRole()} className={styles.btnConfirmRemove}>{removingKey ? 'Quitando…' : 'Sí, quitar rol'}</button>
          </div>
        </section>
      </div>}
      <h3>Membresías registradas</h3>
      <table className={styles.table}>
        <thead><tr><th>Correo</th><th>Rol</th><th>Institución o alcance</th><th>Acciones</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={4}>Cargando membresías…</td></tr>}
          {!loading && members.length === 0 && <tr><td colSpan={4}>Todavía no hay membresías visibles.</td></tr>}
          {members.map((member) => {
            const key = `${member.profile_id}-${member.institution_id}`;
            const canRemove = member.roleName !== 'super_admin' && (isPlatformAdmin || member.institution_id === currentInstitutionId);
            return <tr key={key}>
              <td>{member.email}</td><td>{member.role}</td><td>{member.institution}</td>
              <td>{canRemove && <button type="button" disabled={removingKey === key} onClick={() => void handleRemoveRole(member)} className={styles.btnRemove}>
                {removingKey === key ? 'Quitando…' : 'Quitar rol'}
              </button>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
};
