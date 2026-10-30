import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useTenant, type Institution } from '../../core/TenantContext';
import { useAuth } from '../../core/AuthContext';
import { canonicalRole } from '../../core/auth/institutionalRoles';
import { confirmAction } from '../../shared/components/ConfirmDialog/confirm';
import { moduleClass } from './projectStyles';
import { Field } from './FormField';
import { institutionSwitchSearch } from '../admin/auth/institutionSwitch';

// One remembered choice per account: another user on the same tab never inherits it.
const storageKey = (userId: string) => `projects:institution:${userId}`;
const MANAGER_ROLES = ['super_admin', 'institution_admin', 'projects_manager'];

const readStored = (userId: string) => { try { return sessionStorage.getItem(storageKey(userId)); } catch { return null; } };
const writeStored = (userId: string, id: string) => { try { sessionStorage.setItem(storageKey(userId), id); } catch { /* private window: the URL still carries the choice */ } };

/** Institutions the user may manage here: every one for a superadmin, only their own managed ones otherwise. */
export function manageableInstitutions(institutions: Institution[]): Institution[] {
  return institutions.filter(item => MANAGER_ROLES.includes(canonicalRole(item.role)));
}

/**
 * Keeps the active institution on one the user can manage and restores the one chosen earlier
 * in this session when the URL does not name another.
 */
export function useProjectInstitutionSync(enabled = true) {
  const { institutions, activeInstitution, setActiveInstitution, loadingTenant } = useTenant();
  const userId = useAuth().user?.id ?? '';
  const { search } = useLocation();
  const manageable = useMemo(() => manageableInstitutions(institutions), [institutions]);
  useEffect(() => {
    if (!enabled || !userId || loadingTenant || !manageable.length) return;
    const requested = new URLSearchParams(search).get('institution');
    const stored = requested ? null : manageable.find(item => item.institution_id === readStored(userId));
    const active = activeInstitution && manageable.some(item => item.institution_id === activeInstitution.institution_id) ? activeInstitution : null;
    const target = stored ?? active ?? manageable[0];
    if (target && target.institution_id !== activeInstitution?.institution_id) setActiveInstitution(target);
    else if (active) writeStored(userId, active.institution_id);
  }, [enabled, userId, loadingTenant, manageable, activeInstitution, search, setActiveInstitution]);
}

/**
 * Institution selector for the projects panel. It uses the same TenantContext as the rest of the panel.
 * Shown only to users who can manage more than one institution; otherwise just the name (or nothing).
 */
export function InstitutionSwitcher({ confirmLeave = false, showName = false }: { confirmLeave?: boolean; showName?: boolean }) {
  const { institutions, activeInstitution, setActiveInstitution } = useTenant();
  const userId = useAuth().user?.id ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const manageable = useMemo(() => manageableInstitutions(institutions), [institutions]);
  if (!activeInstitution) return null;
  if (manageable.length < 2) return showName ? <span className={moduleClass('project-institution-name')}>{activeInstitution.name}</span> : null;

  async function change(id: string) {
    const next = manageable.find(item => item.institution_id === id);
    if (!next || next.institution_id === activeInstitution?.institution_id) return;
    if (confirmLeave && !await confirmAction({ title: '¿Cambiar de institución?', message: 'Tienes un formulario abierto con cambios sin guardar. Si continúas, se descartarán.', confirmLabel: 'Descartar y cambiar', tone: 'danger' })) return;
    if (userId) writeStored(userId, next.institution_id);
    setActiveInstitution(next);
    navigate({ pathname: location.pathname, search: institutionSwitchSearch(location.search, next) }, { replace: true });
  }

  return <div className={moduleClass('project-institution')}>
    <Building2 size={18} aria-hidden="true" />
    <Field id="project-institution" label="Institución" className={moduleClass('project-institution-field')}>
      <select id="project-institution" value={activeInstitution.institution_id} onChange={event => void change(event.target.value)}>
        {manageable.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
      </select>
    </Field>
  </div>;
}
