import React, { useEffect, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { logAuditEvent } from '../../../core/auditLogger';
import styles from './SuperAdminPanel.module.css';

interface Institution {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ModuleSetting {
  id: string;
  institution_id: string;
  module_name: string;
  is_enabled: boolean;
}

export const SuperAdminPanel: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [newInstName, setNewInstName] = useState('');
  const [newInstSlug, setNewInstSlug] = useState('');
  const [moduleSettings, setModuleSettings] = useState<ModuleSetting[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchInstitutions = async () => {
    const { data, error } = await supabase.from('institutions').select('*').order('name');
    if (error) setLoadError('No se pudieron cargar las instituciones. Revisa la conexión y los permisos de tu cuenta.');
    else { setInstitutions(data ?? []); setLoadError(''); }
    setLoading(false);
  };

  const fetchModuleSettings = async (instId: string) => {
    const { data, error } = await supabase
      .from('module_settings')
      .select('*')
      .eq('institution_id', instId);
    if (error) setMessage('No se pudo cargar la configuración de módulos.');
    else { setModuleSettings(data ?? []); setMessage(''); }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName || !newInstSlug) return;
    setMessage('');

    const { data, error } = await supabase
      .from('institutions')
      .insert([{ name: newInstName, slug: newInstSlug, is_active: true }])
      .select()
      .single();

    if (error) { setMessage('No se pudo crear la institución. Comprueba que el nombre y el identificador no estén registrados.'); return; }
    if (data) {
      await logAuditEvent({
        action: 'CREATE_INSTITUTION',
        entity: 'institutions',
        entityId: data.id,
        details: { name: newInstName, slug: newInstSlug },
      });

      setNewInstName('');
      setNewInstSlug('');
      setMessage('Institución creada correctamente.');
      void fetchInstitutions();
    }
  };

  const handleToggleModule = async (settingId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('module_settings')
      .update({ is_enabled: !currentState })
      .eq('id', settingId);

    if (!error) {
      await logAuditEvent({
        action: 'TOGGLE_MODULE',
        entity: 'module_settings',
        entityId: settingId,
        details: { new_state: !currentState },
      });
      if (selectedInstId) void fetchModuleSettings(selectedInstId);
    }
  };

  return (
    <div className={styles.panelContainer}>
      <h1>Panel de Control del Superadministrador</h1>

      <section className={styles.section}>
        <h2>Registrar Nueva Institución Educativa</h2>
        <form onSubmit={handleCreateInstitution} className={styles.formInline}>
          <input
            type="text"
            placeholder="Nombre (ej: U.E. Santo Domingo)"
            value={newInstName}
            onChange={(e) => setNewInstName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Slug (ej: ue-santo-domingo)"
            value={newInstSlug}
            onChange={(e) => setNewInstSlug(e.target.value)}
            required
          />
          <button type="submit" className={styles.btnSave}>
            Crear Institución
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>Instituciones Registradas</h2>
        {message && <p role="status">{message}</p>}
        {loadError && <p role="alert">{loadError}</p>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4}>Cargando instituciones…</td></tr>}
            {!loading && !loadError && institutions.length === 0 && <tr><td colSpan={4}>Aún no hay instituciones registradas. Puedes crear la primera desde el formulario.</td></tr>}
            {institutions.map((inst) => (
              <tr key={inst.id}>
                <td>{inst.name}</td>
                <td>{inst.slug}</td>
                <td>{inst.is_active ? 'Activa' : 'Inactiva'}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelectedInstId(inst.id);
                      fetchModuleSettings(inst.id);
                    }}
                    className={styles.btnSelect}
                  >
                    Gestionar Módulos
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedInstId && (
        <section className={styles.section}>
          <h2>Configuración de Módulos para la Institución</h2>
          <div className={styles.moduleGrid}>
            {!message && moduleSettings.length === 0 && <p>No hay módulos configurados para esta institución.</p>}
            {moduleSettings.map((mod) => (
              <div key={mod.id} className={styles.moduleCard}>
                <span>Módulo: <strong>{mod.module_name.toUpperCase()}</strong></span>
                <button
                  onClick={() => handleToggleModule(mod.id, mod.is_enabled)}
                  className={mod.is_enabled ? styles.btnActive : styles.btnInactive}
                >
                  {mod.is_enabled ? 'Habilitado' : 'Deshabilitado'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
