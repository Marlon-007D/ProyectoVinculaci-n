import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { useAuth } from '../../../core/AuthContext';
import { useTenant } from '../../../core/TenantContext';
import { logAuditEvent } from '../../../core/auditLogger';
import styles from './UserManagement.module.css';

interface RoleOption { role_id: string; name: string }
interface UserMember {
  profile_id: string;
  institution_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  institution_name: string;
  mfa_enabled: boolean;
  mfa_required: boolean;
}

const roleLabels: Record<string, string> = {
  institution_admin: 'Administrador institucional',
  dece_staff: 'Equipo DECE',
  project_manager: 'Gestor de proyectos',
  editor: 'Editor de contenidos',
  viewer: 'Consulta',
  student: 'Estudiante',
};
const formatRole = (role: string) => roleLabels[role] ?? role.replaceAll('_', ' ');

export const UserManagement: React.FC = () => {
  const { role: currentRole } = useAuth();
  const { institutions: tenantInstitutions, loadingTenant, activeInstitution } = useTenant();
  const currentInstitutionId = activeInstitution?.institution_id ?? null;
  const isPlatformAdmin = currentRole === 'super_admin';
  const isInstitutionAdmin = activeInstitution?.role === 'institution_admin';
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingKey, setRemovingKey] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<UserMember | null>(null);

  const availableInstitutions = useMemo(() => isPlatformAdmin
    ? tenantInstitutions
    : tenantInstitutions.filter((item) => item.role === 'institution_admin'),
  [isPlatformAdmin, tenantInstitutions]);

  const loadData = useCallback(async () => {
    if (loadingTenant) return;
    setLoading(true);
    setLoadError('');
    const targetInstitutionId = isPlatformAdmin ? null : currentInstitutionId;
    if (!isPlatformAdmin && !targetInstitutionId) {
      setMembers([]);
      setRoles([]);
      setLoadError('Esta cuenta no tiene una institución asignada para administrar.');
      setLoading(false);
      return;
    }

    const membershipQuery = supabase.from('memberships')
      .select('profile_id, institution_id, role_id')
      .eq('is_active', true);
    if (targetInstitutionId) membershipQuery.eq('institution_id', targetInstitutionId);
    const [roleResult, membershipResult] = await Promise.all([
      supabase.from('roles').select('role_id, name').order('name'),
      membershipQuery,
    ]);
    const failure = roleResult.error ?? membershipResult.error;
    if (failure) {
      setMembers([]);
      setRoles([]);
      setLoadError(`No se pudieron cargar los usuarios y roles. ${failure.message}`);
      setLoading(false);
      return;
    }

    setRoles((roleResult.data ?? []).filter((item) => item.name !== 'super_admin' && (isPlatformAdmin || item.name !== 'institution_admin')));
    type MembershipRow = { profile_id: string; institution_id: string; role_id: string };
    type ProfileRow = { profile_id: string; email: string; first_name: string; last_name: string; mfa_enabled: boolean; mfa_required: boolean };
    const memberships = (membershipResult.data ?? []) as MembershipRow[];
    const profileIds = [...new Set(memberships.map((item) => item.profile_id))];
    const profileResult = profileIds.length
      ? await supabase.from('profiles')
        .select('profile_id, email, first_name, last_name, mfa_enabled, mfa_required')
        .in('profile_id', profileIds)
      : { data: [], error: null };
    if (profileResult.error) {
      setMembers([]);
      setLoadError('No se pudieron cargar los perfiles. ' + profileResult.error.message);
      setLoading(false);
      return;
    }
    const profileById = new Map(((profileResult.data ?? []) as ProfileRow[]).map((item) => [item.profile_id, item]));
    const roleById = new Map(((roleResult.data ?? []) as RoleOption[]).map((item) => [item.role_id, item.name]));
    const institutionNameById = new Map(tenantInstitutions.map((item) => [item.institution_id, item.name]));
    setMembers(memberships.map((membership) => {
      const profile = profileById.get(membership.profile_id);
      return {
        profile_id: membership.profile_id,
        institution_id: membership.institution_id,
        email: profile?.email ?? '',
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        role_name: roleById.get(membership.role_id) ?? 'unknown',
        institution_name: institutionNameById.get(membership.institution_id) ?? '',
        mfa_enabled: profile?.mfa_enabled ?? false,
        mfa_required: profile?.mfa_required ?? false,
      };
    }));
    setLoading(false);
  }, [currentInstitutionId, isPlatformAdmin, loadingTenant, tenantInstitutions]);

  useEffect(() => {
    if (loadingTenant) return;
    setInstitutionId((current) => {
      if (!isPlatformAdmin) return currentInstitutionId ?? '';
      return availableInstitutions.some((item) => item.institution_id === current) ? current : '';
    });
    void loadData();
  }, [availableInstitutions, currentInstitutionId, isPlatformAdmin, loadData, loadingTenant]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return members.filter((member) => {
      const matchesInstitution = !isPlatformAdmin || !institutionId || member.institution_id === institutionId;
      const matchesRole = !roleFilter || member.role_name === roleFilter;
      const matchesSearch = !normalizedSearch || [member.email, member.first_name, member.last_name, member.institution_name, formatRole(member.role_name)]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
      return matchesInstitution && matchesRole && matchesSearch;
    });
  }, [institutionId, isPlatformAdmin, members, roleFilter, search]);

  const filterRoles = useMemo(() => [...new Set(members.map((member) => member.role_name))].sort(), [members]);

  const pendingMfaCount = filteredMembers.filter((member) => member.mfa_required && !member.mfa_enabled).length;

  const handleAssignUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg('');
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone = phone.trim();
    const selectedRole = roles.find((item) => item.role_id === roleId);
    const targetInstitutionId = isPlatformAdmin ? institutionId : currentInstitutionId;

    if (!normalizedFirstName || !normalizedLastName) {
      setFeedbackType('error');
      setMsg('Escribe los nombres y apellidos reales de la persona.');
      return;
    }
    if (!/^09\d{8}$/.test(normalizedPhone)) {
      setFeedbackType('error');
      setMsg('Ingresa un celular ecuatoriano de 10 dígitos que empiece con 09.');
      return;
    }
    if (!targetInstitutionId || !selectedRole) {
      setFeedbackType('error');
      setMsg('Selecciona la institución y el rol que vas a asignar.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('assign_institution_role', {
        target_email: normalizedEmail,
        target_role_id: roleId,
        target_institution_id: targetInstitutionId,
        target_first_name: normalizedFirstName,
        target_last_name: normalizedLastName,
        target_phone: normalizedPhone,
      });

      if (error) {
        const missingAccount = error.message.includes('No existe una cuenta registrada');
        if (missingAccount && (isPlatformAdmin || (isInstitutionAdmin && availableInstitutions.some(item => item.institution_id === targetInstitutionId)))) {
          const { data, error: inviteError } = await supabase.functions.invoke('invite-institution-user', {
            body: { email: normalizedEmail, roleId, institutionId: targetInstitutionId, firstName: normalizedFirstName, lastName: normalizedLastName, phone: normalizedPhone },
          });
          if (inviteError) {
            const details = typeof inviteError.context?.json === 'function'
              ? await inviteError.context.json().catch(() => null)
              : null;
            setFeedbackType('error');
            setMsg(details?.error ?? `No se pudo enviar la invitación: ${inviteError.message}. Verifica que la función invite-institution-user esté desplegada en Supabase.`);
            return;
          }
          await logAuditEvent({ action: 'INVITE_AND_ASSIGN_ROLE', entity: 'memberships', details: { email: normalizedEmail, roleId, institutionId: targetInstitutionId }, institutionId: targetInstitutionId });
          setFeedbackType('success');
          setMsg(data?.message ?? 'Invitación enviada. La cuenta recibirá un correo para activar su acceso y configurar MFA.');
          clearForm();
          await loadData();
          return;
        }
        setFeedbackType('error');
        setMsg(missingAccount
          ? 'La cuenta no existe y tu membresia no permite invitar usuarios a esta institucion.'
          : `No se pudo asignar el rol: ${error.message}`);
        return;
      }

      await logAuditEvent({ action: 'ASSIGN_ROLE', entity: 'memberships', details: { email: normalizedEmail, roleId, institutionId: targetInstitutionId }, institutionId: targetInstitutionId });
      setFeedbackType('success');
      setMsg('Rol asignado. Se solicitará configurar TOTP al iniciar sesión si la cuenta aún no lo tiene habilitado.');
      clearForm();
      await loadData();
    } catch {
      setFeedbackType('error');
      setMsg('Ocurrió un problema de conexión al asignar el rol. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setRoleId('');
  };

  const confirmRemoveRole = async () => {
    if (!pendingRemoval || removingKey) return;
    const member = pendingRemoval;
    const key = `${member.profile_id}-${member.institution_id}`;
    setRemovingKey(key);
    setMsg('');
    try {
      const { error } = await supabase.rpc('remove_institution_role', {
        target_institution_id: member.institution_id,
        target_profile_id: member.profile_id,
      });
      if (error) throw error;
      setPendingRemoval(null);
      await logAuditEvent({ action: 'REMOVE_ROLE', entity: 'memberships', details: { email: member.email, role: member.role_name }, institutionId: member.institution_id });
      setFeedbackType('success');
      setMsg(`Se quitó el rol de ${member.email} en ${member.institution_name}.`);
      await loadData();
    } catch (error) {
      setFeedbackType('error');
      setMsg(`No se pudo quitar el rol: ${error instanceof Error ? error.message : 'Error de conexión.'}`);
    } finally {
      setRemovingKey('');
    }
  };

  return (
    <section className={styles.container} aria-labelledby="institution-users-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SEGURIDAD Y ACCESOS</p>
          <h2 id="institution-users-title">Usuarios y roles institucionales</h2>
          <p className={styles.intro}>{isPlatformAdmin
            ? 'Administra los roles de cada unidad educativa y consulta el estado de seguridad de sus cuentas.'
            : 'Administra los permisos de las cuentas pertenecientes a tu institución.'}</p>
        </div>
        <span className={styles.scopeBadge}>{isPlatformAdmin ? 'Alcance global' : availableInstitutions[0]?.name ?? 'Tu institución'}</span>
      </header>

      <div className={styles.summary} aria-label="Resumen de cuentas">
        <article className={styles.summaryCard}><span className={styles.summaryIcon}>U</span><div><span>Usuarios visibles</span><strong>{loading ? '—' : filteredMembers.length}</strong></div></article>
        <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.secureIcon}`}>✓</span><div><span>Con TOTP activo</span><strong>{loading ? '—' : filteredMembers.filter((member) => member.mfa_enabled).length}</strong></div></article>
        <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.pendingIcon}`}>!</span><div><span>MFA pendiente</span><strong>{loading ? '—' : pendingMfaCount}</strong></div></article>
      </div>

      <section className={styles.assignmentCard} aria-labelledby="assign-user-title">
        <div className={styles.sectionHeading}>
          <div><h3 id="assign-user-title">Asignar un rol</h3><p>Los permisos se limitan a la institución seleccionada. La contraseña nunca se solicita ni se almacena aquí.</p></div>
          <span className={styles.secureLabel}><span aria-hidden="true">●</span> Operación protegida</span>
        </div>
        {!isPlatformAdmin && <p className={styles.scopeNotice}>Las asignaciones se aplican únicamente a <strong>{availableInstitutions[0]?.name ?? 'tu institución asignada'}</strong>.</p>}
        <form onSubmit={handleAssignUser} className={styles.form} aria-busy={saving}>
          <label className={styles.field} htmlFor="member-email">Correo de la cuenta
            <input id="member-email" type="email" autoComplete="email" placeholder="persona@institucion.edu.ec" value={email} onChange={(event) => setEmail(event.target.value)} required className={styles.input} />
          </label>
          <label className={styles.field} htmlFor="member-first-name">Nombres
            <input id="member-first-name" type="text" autoComplete="given-name" placeholder="Nombres reales" value={firstName} onChange={(event) => setFirstName(event.target.value)} required className={styles.input} />
          </label>
          <label className={styles.field} htmlFor="member-last-name">Apellidos
            <input id="member-last-name" type="text" autoComplete="family-name" placeholder="Apellidos reales" value={lastName} onChange={(event) => setLastName(event.target.value)} required className={styles.input} />
          </label>
          <label className={styles.field} htmlFor="member-phone">Celular
            <input id="member-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="09XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} minLength={10} maxLength={10} pattern="09[0-9]{8}" title="Ingresa 10 dígitos, empezando por 09" required className={styles.input} />
          </label>
          <label className={styles.field} htmlFor="member-role">Rol institucional
            <select id="member-role" value={roleId} onChange={(event) => setRoleId(event.target.value)} required className={styles.select}>
              <option value="">Seleccionar rol</option>
              {roles.map((item) => <option key={item.role_id} value={item.role_id}>{formatRole(item.name)}</option>)}
            </select>
          </label>
          {isPlatformAdmin && <label className={styles.field} htmlFor="member-institution">Institución
            <select id="member-institution" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} required className={styles.select}>
              <option value="">Seleccionar institución</option>
              {availableInstitutions.map((institution) => <option key={institution.institution_id} value={institution.institution_id}>{institution.name}</option>)}
            </select>
          </label>}
          <button type="submit" disabled={saving || loading || availableInstitutions.length === 0} className={styles.btnSubmit}>
            {saving && <span className={styles.buttonSpinner} aria-hidden="true" />}{saving ? ' Preparando invitación…' : 'Asignar rol'}
          </button>
        </form>
        {saving && <p className={styles.progressNotice} role="status" aria-live="polite">Verificando la cuenta y preparando la asignación o invitación segura…</p>}
        {msg && <p role={feedbackType === 'error' ? 'alert' : 'status'} className={feedbackType === 'error' ? styles.errorFeedback : styles.successFeedback}>{msg}</p>}
      </section>

      <section className={styles.membersCard} aria-labelledby="members-title">
        <div className={styles.membersHeading}>
          <div><h3 id="members-title">Membresías registradas</h3><p>El estado TOTP indica si la cuenta está protegida y si debe completar el enrolamiento.</p></div>
          <div className={styles.filters}>
            {isPlatformAdmin && <label className={styles.srOnly} htmlFor="membership-institution-filter">Filtrar por institución</label>}
            {isPlatformAdmin && <select id="membership-institution-filter" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} className={styles.filterSelect}>
              <option value="">Todas las instituciones</option>
              {availableInstitutions.map((institution) => <option key={institution.institution_id} value={institution.institution_id}>{institution.name}</option>)}
            </select>}
            <label className={styles.srOnly} htmlFor="membership-role-filter">Filtrar por rol</label>
            <select id="membership-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={styles.filterSelect}>
              <option value="">Todos los roles</option>
              {filterRoles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
            </select>
            <label className={styles.srOnly} htmlFor="membership-search">Buscar usuarios</label>
            <input id="membership-search" type="search" placeholder="Buscar correo, nombre o rol" value={search} onChange={(event) => setSearch(event.target.value)} className={styles.searchInput} />
          </div>
        </div>
        {loadError && <p role="alert" className={styles.errorFeedback}>{loadError}</p>}
        {loading ? <div className={styles.tableWrap} role="status" aria-label="Cargando usuarios y roles">
          <table className={styles.table} aria-hidden="true">
            <thead><tr><th>Cuenta</th><th>Rol</th><th>Institución</th><th>Autenticación</th><th>Acciones</th></tr></thead>
            <tbody>{[0, 1, 2, 3].map(row => <tr className={styles.skeletonRow} key={row}>
              <td><span className={`${styles.skeleton} ${styles.skeletonPerson}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonRole}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonInstitution}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonMfa}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonAction}`} /></td>
            </tr>)}</tbody>
          </table>
        </div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Cuenta</th><th>Rol</th><th>Institución</th><th>Autenticación</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredMembers.length === 0 && <tr><td colSpan={5} className={styles.emptyState}>No hay membresías que coincidan con estos filtros.</td></tr>}
                {filteredMembers.map((member) => {
                  const key = `${member.profile_id}-${member.institution_id}`;
                  const mfaStatus = member.mfa_enabled ? 'Activo' : member.mfa_required ? 'Pendiente' : 'No requerido';
                  const mfaClass = member.mfa_enabled ? styles.mfaActive : member.mfa_required ? styles.mfaPending : styles.mfaOptional;
                  const displayName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
                  return <tr key={key}>
                    <td><div className={styles.personCell}><span className={styles.avatar} aria-hidden="true">{(displayName || member.email || '?').charAt(0).toUpperCase()}</span><span><strong>{displayName || 'Perfil sin nombre'}</strong><small>{member.email || 'Correo no disponible'}</small></span></div></td>
                    <td><span className={styles.roleBadge}>{formatRole(member.role_name)}</span></td>
                    <td>{member.institution_name || 'Alcance global'}</td>
                    <td><span className={`${styles.mfaBadge} ${mfaClass}`}><span aria-hidden="true" />{mfaStatus}</span></td>
                    <td>{member.role_name !== 'super_admin' && <button type="button" disabled={removingKey === key} onClick={() => { setMsg(''); setPendingRemoval(member); }} className={styles.btnRemove} aria-label={`Quitar rol de ${member.email}`}>
                      {removingKey === key ? 'Quitando…' : 'Quitar rol'}
                    </button>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendingRemoval && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !removingKey) setPendingRemoval(null); }}>
        <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="remove-role-title" aria-describedby="remove-role-description">
          <span className={styles.modalEyebrow}>CONFIRMAR CAMBIO DE ACCESO</span>
          <h3 id="remove-role-title">¿Quitar este rol?</h3>
          <p id="remove-role-description">Se quitará el rol <strong>{formatRole(pendingRemoval.role_name)}</strong> de <strong>{pendingRemoval.email}</strong> en {pendingRemoval.institution_name}. La cuenta de autenticación no se eliminará.</p>
          {msg && feedbackType === 'error' && <p role="alert" className={styles.modalError}>{msg}</p>}
          <div className={styles.modalActions}>
            <button type="button" disabled={Boolean(removingKey)} onClick={() => { setPendingRemoval(null); setMsg(''); }} className={styles.btnCancel}>Cancelar</button>
            <button type="button" disabled={Boolean(removingKey)} onClick={() => void confirmRemoveRole()} className={styles.btnConfirmRemove}>{removingKey ? 'Quitando…' : 'Sí, quitar rol'}</button>
          </div>
        </section>
      </div>}
    </section>
  );
};
