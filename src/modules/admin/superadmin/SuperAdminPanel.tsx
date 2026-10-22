import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { logAuditEvent } from '../../../core/auditLogger';
import { useTenant } from '../../../core/TenantContext';
import styles from './SuperAdminPanel.module.css';

interface Institution {
  institution_id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ModuleSetting {
  module_setting_id: string;
  institution_id: string;
  module_name: string;
  is_enabled: boolean;
}

const INSTITUTION_MODULES = [
  { name: 'inicio', label: 'Inicio', description: 'Panel principal de la institución' },
  { name: 'projects', label: 'Proyectos', description: 'Gestión de proyectos de vinculación' },
  { name: 'dece', label: 'DECE', description: 'Consejería y acompañamiento estudiantil' },
  { name: 'simuladores', label: 'Simuladores', description: 'Herramientas académicas interactivas' },
  { name: 'portal', label: 'Portal web', description: 'Contenido y sitio público institucional' },
] as const;

export const SuperAdminPanel: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [newInstName, setNewInstName] = useState('');
  const [newInstSlug, setNewInstSlug] = useState('');
  const [moduleSettings, setModuleSettings] = useState<ModuleSetting[]>([]);
  const [institutionModuleSettings, setInstitutionModuleSettings] = useState<ModuleSetting[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [moduleLoadError, setModuleLoadError] = useState('');
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [institutionToDelete, setInstitutionToDelete] = useState<Institution | null>(null);
  const [deletingInstitution, setDeletingInstitution] = useState(false);
  const initialLoadStarted = useRef(false);
  const { reloadInstitutions } = useTenant();
  const selectedInstitution = institutions.find((institution) => institution.institution_id === selectedInstId);
  const activeCount = institutions.filter((institution) => institution.is_active).length;

  const fetchInstitutions = async () => {
    const [institutionResult, settingsResult] = await Promise.all([
      supabase.from('institutions').select('institution_id, name, slug, is_active').order('name'),
      supabase.rpc('get_accessible_module_settings'),
    ]);
    if (institutionResult.error) setLoadError('No se pudieron cargar las instituciones. Revisa la conexión y los permisos de tu cuenta.');
    else {
      setInstitutions(institutionResult.data ?? []);
      setInstitutionModuleSettings(settingsResult.error ? [] : (settingsResult.data ?? []) as ModuleSetting[]);
      setLoadError('');
    }
    setLoading(false);
  };

  const fetchModuleSettings = async (instId: string) => {
    setLoadingModules(true);
    setModuleLoadError('');
    try {
      const { data, error } = await supabase.rpc('get_accessible_module_settings');
      if (error) {
        setModuleLoadError('No se pudo cargar la configuración. Aplica la migración de módulos por institución.');
        setModuleSettings([]);
      } else {
        setModuleSettings((data ?? []).filter((setting: ModuleSetting) => setting.institution_id === instId));
        setModuleLoadError('');
      }
    } catch {
      setModuleLoadError('No se pudo conectar con la configuración de módulos. Inténtalo de nuevo.');
      setModuleSettings([]);
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void fetchInstitutions();
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
        entityId: data.institution_id,
        details: { name: newInstName, slug: newInstSlug },
      });

      setNewInstName('');
      setNewInstSlug('');
      setMessage('Institución creada correctamente.');
      void fetchInstitutions();
      reloadInstitutions();
    }
  };

  const handleToggleModule = async (moduleName: string, currentState: boolean) => {
    if (!selectedInstId || savingModule) return;
    const institutionId = selectedInstId;
    setSavingModule(moduleName);
    setMessage('');
    try {
      const { data: settingId, error } = await supabase.rpc('set_institution_module_enabled', {
        target_institution_id: institutionId,
        target_module_name: moduleName,
        target_is_enabled: !currentState,
      });
      if (error) throw error;
      await logAuditEvent({
        action: 'TOGGLE_MODULE',
        entity: 'module_settings',
        entityId: settingId ?? `${institutionId}:${moduleName}`,
        details: { new_state: !currentState },
      });
      await fetchModuleSettings(institutionId);
      await fetchInstitutions();
      reloadInstitutions();
    } catch {
      setMessage('No se pudo actualizar el módulo. Revisa los permisos de la cuenta.');
    } finally {
      setSavingModule(null);
    }
  };

  const activeModuleLabels = (institutionId: string) => institutionModuleSettings
    .filter((setting) => setting.institution_id === institutionId && setting.is_enabled && setting.module_name !== 'inicio')
    .map((setting) => INSTITUTION_MODULES.find((module) => module.name === setting.module_name)?.label ?? setting.module_name);

  const openInstitutionPreview = (slug: string) => {
    const previewUrl = new URL('/portal', window.location.origin);
    previewUrl.searchParams.set('institution', slug);
    window.open(previewUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleDeleteInstitution = async () => {
    if (!institutionToDelete || deletingInstitution) return;
    setDeletingInstitution(true);
    setMessage('');
    const target = institutionToDelete;
    const { error } = await supabase.rpc('delete_institution', {
      target_institution_id: target.institution_id,
    });
    if (error) {
      setMessage(`No se pudo eliminar la institución. ${error.message}`);
      setDeletingInstitution(false);
      return;
    }
    await logAuditEvent({
      action: 'DELETE_INSTITUTION',
      entity: 'institutions',
      entityId: target.institution_id,
      details: { name: target.name, slug: target.slug },
    });
    if (selectedInstId === target.institution_id) {
      setSelectedInstId(null);
      setModuleSettings([]);
    }
    setInstitutionToDelete(null);
    setMessage(`Se eliminó ${target.name} y sus datos asociados.`);
    setDeletingInstitution(false);
    await fetchInstitutions();
    reloadInstitutions();
  };

  return (
    <div className={styles.panelContainer}>
      <section className={styles.hero}>
        <div>
          <h1>Instituciones educativas</h1>
          <p className={styles.heroCopy}>Administra las unidades de la red, revisa su estado y configura los módulos disponibles para cada institución.</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">UE</div>
      </section>

      <div className={styles.statsGrid} aria-label="Resumen de instituciones">
        <article className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true">⌂</span>
          <div><span className={styles.statLabel}>Instituciones registradas</span><strong className={styles.statValue}>{loading ? '—' : institutions.length}</strong></div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true">✓</span>
          <div><span className={styles.statLabel}>Instituciones activas</span><strong className={styles.statValue}>{loading ? '—' : activeCount}</strong></div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon} aria-hidden="true">◷</span>
          <div><span className={styles.statLabel}>Instituciones inactivas</span><strong className={styles.statValue}>{loading ? '—' : institutions.length - activeCount}</strong></div>
        </article>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Registrar institución</h2>
            <p>Incorpora una unidad educativa a la red institucional.</p>
          </div>
        </div>
        <form onSubmit={handleCreateInstitution} className={styles.formInline}>
          <label className={styles.field}>Nombre de la institución
            <input type="text" placeholder="Ej. Unidad Educativa Santo Domingo" value={newInstName} onChange={(e) => setNewInstName(e.target.value)} required />
          </label>
          <label className={styles.field}>Identificador (slug)
            <input type="text" placeholder="Ej. ue-santo-domingo" value={newInstSlug} onChange={(e) => setNewInstSlug(e.target.value)} required />
          </label>
          <button type="submit" className={styles.btnSave}>Crear institución <span aria-hidden="true">＋</span></button>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Unidades educativas</h2>
            <p>Consulta el estado de cada institución y administra sus módulos.</p>
          </div>
        </div>
        {message && <p className={styles.notice} role="status">{message}</p>}
        {loadError && <p className={styles.errorNotice} role="alert">{loadError}</p>}
        {loading ? <div className={styles.tableWrap} role="status" aria-label="Cargando instituciones">
          <table className={styles.table} aria-hidden="true">
            <thead><tr><th>Institución</th><th>Identificador</th><th>Módulos activos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{[0, 1, 2].map(row => <tr key={row} className={styles.skeletonRow}>
              <td><span className={`${styles.skeleton} ${styles.skeletonInstitution}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonSlug}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonModules}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonStatus}`} /></td>
              <td><span className={`${styles.skeleton} ${styles.skeletonAction}`} /></td>
            </tr>)}</tbody>
          </table>
        </div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Institución</th><th>Identificador</th><th>Módulos activos</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {!loadError && institutions.length === 0 && <tr><td colSpan={5} className={styles.emptyState}>Aún no hay instituciones registradas. Puedes crear la primera desde el formulario.</td></tr>}
                {institutions.map((inst) => (
                  <tr key={inst.institution_id}>
                    <td><div className={styles.institutionCell}><span className={styles.institutionMark} aria-hidden="true">{inst.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><span className={styles.institutionName}>{inst.name}</span><span className={styles.institutionMeta}>Unidad educativa</span></span></div></td>
                    <td><span className={styles.slug}>{inst.slug}</span></td>
                    <td><div className={styles.moduleBadges}>{activeModuleLabels(inst.institution_id).length > 0 ? activeModuleLabels(inst.institution_id).map((label) => <span key={label} className={styles.moduleBadge}>{label}</span>) : <span className={styles.noModules}>Sin módulos activos</span>}</div></td>
                    <td><span className={`${styles.status} ${!inst.is_active ? styles.statusInactive : ''}`}>{inst.is_active ? 'Activa' : 'Inactiva'}</span></td>
                    <td><div className={styles.actions}>
                      <button type="button" onClick={() => openInstitutionPreview(inst.slug)} className={styles.btnPreview}>Vista previa de institución</button>
                      <button type="button" onClick={() => { setSelectedInstId(inst.institution_id); fetchModuleSettings(inst.institution_id); }} className={styles.btnSelect}>Gestionar módulos</button>
                      <button type="button" onClick={() => setInstitutionToDelete(inst)} className={styles.btnDelete} aria-label={`Eliminar ${inst.name}`}>Eliminar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedInstId && (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>Módulos de {selectedInstitution?.name ?? 'la institución'}</h2>
              <p>Activa o desactiva las herramientas disponibles para esta unidad.</p>
            </div>
          </div>
          {moduleLoadError && <p className={styles.errorNotice} role="alert">{moduleLoadError}</p>}
          <div className={styles.moduleGrid}>
            {loadingModules ? <p className={styles.loadingState}>Cargando configuración de módulos…</p> : !moduleLoadError && INSTITUTION_MODULES.map((module) => {
              const setting = moduleSettings.find((item) => item.module_name === module.name);
              const isEnabled = setting?.is_enabled ?? false;
              const isSaving = savingModule === module.name;
              return (
                <article key={module.name} className={styles.moduleCard}>
                  <div><span>{module.description}</span><strong>{module.label}</strong></div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`${isEnabled ? 'Desactivar' : 'Activar'} módulo ${module.label}`}
                    disabled={Boolean(savingModule) || Boolean(moduleLoadError)}
                    onClick={() => void handleToggleModule(module.name, isEnabled)}
                    className={isEnabled ? styles.btnActive : styles.btnInactive}
                  >
                    {isSaving ? 'Guardando…' : isEnabled ? 'Activo' : 'Inactivo'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {institutionToDelete && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deletingInstitution) setInstitutionToDelete(null);
        }}>
          <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="delete-institution-title">
            <p className={styles.modalEyebrow}>ELIMINACIÓN PERMANENTE</p>
            <h2 id="delete-institution-title">¿Eliminar esta unidad educativa?</h2>
            <p>Se eliminará <strong>{institutionToDelete.name}</strong>, incluidas sus membresías, módulos y demás datos asociados. Esta acción no se puede deshacer.</p>
            {message && <p className={styles.modalError} role="alert">{message}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnCancel} disabled={deletingInstitution} onClick={() => setInstitutionToDelete(null)}>Cancelar</button>
              <button type="button" className={styles.btnDeleteConfirm} disabled={deletingInstitution} onClick={() => void handleDeleteInstitution()}>
                {deletingInstitution ? 'Eliminando…' : 'Sí, eliminar unidad'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
