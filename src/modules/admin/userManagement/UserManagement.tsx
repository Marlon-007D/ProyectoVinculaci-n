import React, { useEffect, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { logAuditEvent } from '../../../core/auditLogger';
import styles from './UserManagement.module.css';

interface InstitutionOption {
  institution_id: string;
  name: string;
}

interface RoleOption {
  role_id: string;
  name: string;
}

interface UserMember {
  profile_id: string;
  email: string;
  role: string;
  institution: string;
}

export const UserManagement: React.FC = () => {
  const [profileId, setProfileId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [institutionResult, roleResult, membershipResult] = await Promise.all([
      supabase.from('institutions').select('institution_id, name').order('name'),
      supabase.from('roles').select('role_id, name').order('name'),
      supabase
        .from('memberships')
        .select('profile_id, profiles!fk_memberships_profile(email), roles!fk_memberships_role(name), institutions!fk_memberships_institution(name)')
        .order('profile_id'),
    ]);

    const failure = institutionResult.error ?? roleResult.error ?? membershipResult.error;
    if (failure) {
      setLoadError('No se pudieron cargar los usuarios y roles. Verifica que ejecutaste la migración de acceso de superadministrador.');
    } else {
      setInstitutions(institutionResult.data ?? []);
      setRoles(roleResult.data ?? []);
      const rows = (membershipResult.data ?? []) as unknown as {
        profile_id: string;
        profiles: { email: string } | null;
        roles: { name: string } | null;
        institutions: { name: string } | null;
      }[];
      setMembers(rows.map((row) => ({
        profile_id: row.profile_id,
        email: row.profiles?.email ?? 'Correo no disponible',
        role: row.roles?.name ?? 'Rol desconocido',
        institution: row.institutions?.name ?? 'Institución desconocida',
      })));
      setLoadError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAssignUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg('');
    const id = profileId.trim();
    const { error } = await supabase.from('memberships').insert({
      profile_id: id,
      role_id: roleId,
      institution_id: institutionId,
    });

    if (error) {
      setMsg('No se pudo asignar el rol. Revisa el UUID, la institución y que el usuario tenga un perfil registrado.');
      return;
    }

    await logAuditEvent({
      action: 'ASSIGN_ROLE',
      entity: 'memberships',
      details: { profileId: id, roleId, institutionId },
      institutionId,
    });
    setMsg('Rol e institución asignados correctamente.');
    setProfileId('');
    await loadData();
  };

  return (
    <div className={styles.container}>
      <h2>Gestión de usuarios y administradores</h2>
      <p>Asigna un rol institucional a una cuenta que ya tenga un perfil registrado.</p>
      {loadError && <p role="alert">{loadError}</p>}
      <form onSubmit={handleAssignUser} className={styles.form}>
        <label htmlFor="member-profile-id">ID del perfil</label>
        <input
          id="member-profile-id"
          type="text"
          placeholder="UUID de la cuenta institucional"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          required
          className={styles.input}
        />
        <label htmlFor="member-role">Rol</label>
        <select id="member-role" value={roleId} onChange={(event) => setRoleId(event.target.value)} required className={styles.select}>
          <option value="">Seleccionar rol</option>
          {roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}
        </select>
        <label htmlFor="member-institution">Institución</label>
        <select id="member-institution" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} required className={styles.select}>
          <option value="">Seleccionar institución</option>
          {institutions.map((institution) => <option key={institution.institution_id} value={institution.institution_id}>{institution.name}</option>)}
        </select>
        <button type="submit" className={styles.btnSubmit}>Asignar rol</button>
      </form>
      {msg && <p role="status">{msg}</p>}

      <h3>Membresías registradas</h3>
      <table className={styles.table}>
        <thead><tr><th>Correo</th><th>Rol</th><th>Institución</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={3}>Cargando membresías…</td></tr>}
          {!loading && members.length === 0 && <tr><td colSpan={3}>Todavía no hay membresías visibles.</td></tr>}
          {members.map((member) => <tr key={`${member.profile_id}-${member.institution}`}><td>{member.email}</td><td>{member.role}</td><td>{member.institution}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
};
