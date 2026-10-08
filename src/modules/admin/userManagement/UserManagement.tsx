import React, { useEffect, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { logAuditEvent } from '../../../core/auditLogger';
import styles from './UserManagement.module.css';

interface UserMember {
  user_id: string;
  role: string;
}

export const UserManagement: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('admin');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [{ data: instData }, { data: memData }] = await Promise.all([
        supabase.from('institutions').select('id, name').order('name'),
        supabase.from('memberships').select('user_id, role').order('role'),
      ]);
      if (instData) setInstitutions(instData);
      if (memData) setMembers(memData);
      setLoading(false);
    };
    void loadData();
  }, []);

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const id = userId.trim();
    const { error } = await supabase.from('memberships').insert([
      { user_id: id, role, institution_id: institutionId },
    ]);

    if (error) {
      setMsg('No se pudo asignar el acceso. Verifica el ID de usuario, la institución y los permisos.');
      return;
    }
    await logAuditEvent({
      action: 'ASSIGN_ROLE',
      entity: 'memberships',
      details: { userId: id, role, institutionId },
      institutionId,
    });
    setMsg('Rol e institución asignados correctamente.');
    setUserId('');
    const { data } = await supabase.from('memberships').select('user_id, role').order('role');
    if (data) setMembers(data);
  };

  return (
    <div className={styles.container}>
      <h2>Gestión de usuarios y administradores</h2>
      <p>Asigna un rol institucional a una cuenta que ya esté registrada en la plataforma.</p>
      <form onSubmit={handleAssignUser} className={styles.form}>
        <label htmlFor="member-user-id">ID de usuario</label>
        <input
          id="member-user-id"
          type="text"
          placeholder="UUID de la cuenta institucional"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          className={styles.input}
        />
        <label htmlFor="member-role">Rol</label>
        <select id="member-role" value={role} onChange={(e) => setRole(e.target.value)} className={styles.select}>
          <option value="admin">Administrador de colegio</option>
          <option value="docente">Docente</option>
          <option value="dece">Especialista DECE</option>
        </select>
        <label htmlFor="member-institution">Institución</label>
        <select id="member-institution" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} required className={styles.select}>
          <option value="">Seleccionar institución</option>
          {institutions.map((inst) => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
        </select>
        <button type="submit" className={styles.btnSubmit}>Asignar rol</button>
      </form>
      {msg && <p role="status">{msg}</p>}

      <h3>Membresías registradas</h3>
      <table className={styles.table}>
        <thead><tr><th>ID de usuario</th><th>Rol</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={2}>Cargando membresías…</td></tr>}
          {!loading && members.length === 0 && <tr><td colSpan={2}>Todavía no hay membresías registradas.</td></tr>}
          {members.map((member) => <tr key={`${member.user_id}-${member.role}`}><td>{member.user_id}</td><td>{member.role}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
};
