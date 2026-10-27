import { useTenant } from '../../../core/TenantContext';
import { UserManagement } from '../userManagement/UserManagement';
import type { TenantAdminService } from '../userManagement/tenantAdmin.types';
import styles from './SuperAdminPanel.module.css';

export function SuperAdminPanel({ service }: { service: TenantAdminService }) {
  const { activeInstitution } = useTenant();
  return <section className={styles.panelContainer}>
    <header className={styles.hero}><div><h1>Super Admin de la unidad educativa</h1><p className={styles.heroCopy}>{activeInstitution?.name}</p></div></header>
    <UserManagement service={service} />
  </section>;
}
