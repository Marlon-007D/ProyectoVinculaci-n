import { useId } from 'react';
import { selectableAdminTenants, type AssignedAdminTenant } from './tenantSelection';
import styles from './TenantSelector.module.css';

interface TenantSelectorProps {
  institutions: readonly AssignedAdminTenant[];
  selectedId: string;
  onSelect: (institutionId: string) => void;
}

export function TenantSelector({ institutions, selectedId, onSelect }: TenantSelectorProps) {
  const id = useId();
  const choices = selectableAdminTenants(institutions);
  if (!choices.length) return null;
  return <section className={styles.container} aria-label="Selección de unidad educativa">
    <div className={styles.description}><label htmlFor={id}>Unidad Educativa</label><p>Gestiona los administradores del plantel seleccionado.</p></div>
    <select id={id} className={styles.select} value={selectedId} disabled={choices.length < 2}
      onChange={event => onSelect(event.target.value)}>
      {!choices.some(item => item.institution_id === selectedId) && <option value="" disabled>Seleccionar unidad educativa</option>}
      {choices.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
    </select>
  </section>;
}
