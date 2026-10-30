import layout from './UserManagement.module.css';
import styles from './AdminSkeleton.module.css';

const placeholders = ['first', 'second', 'third'] as const;

function SkeletonTable({ title, columns }: { title: string; columns: readonly string[] }) {
  return <section>
    <h3>{title}</h3>
    <div className={layout.tableWrap} aria-hidden="true">
      <table className={layout.table}>
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{placeholders.map(row => <tr key={row}>{columns.map((column, index) => <td key={column}>
          <span className={index === columns.length - 1 ? styles.action : styles.line} />
          {index === 0 && <span className={styles.detail} />}
        </td>)}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function AssignedModulesSkeleton() {
  return <section className={styles.modules} aria-busy="true" aria-label="Cargando módulos asignados">
    <h3>Módulos asignados</h3>
    <div aria-hidden="true" className={styles.moduleList}>{['inicio', 'projects', 'simuladores', 'portal', 'dece'].map(module =>
      <div className={styles.module} key={module}><span className={styles.square} /><span className={styles.line} /></div>)}</div>
  </section>;
}

/** Presentation only: mounted exclusively by the existing loading branches. */
export function AdminSkeleton() {
  return <section className={layout.container} aria-busy="true" aria-label="Cargando administración institucional">
    <p role="status" className="visually-hidden">Cargando los datos de tu institución</p>
    <section className={layout.assignmentCard}>
      <h3>Asignar acceso</h3>
      <div className={layout.form}>
        {['Correo', 'Nombres', 'Apellidos', 'Celular', 'Rol'].map(label => <div className={layout.field} key={label} aria-hidden="true">{label}<span className={styles.input} /></div>)}
        <AssignedModulesSkeleton />
      </div>
    </section>
    <section className={layout.membersCard}>
      <SkeletonTable title="Miembros de la Unidad Educativa" columns={['Cuenta', 'Rol', 'Módulos', 'Estado', 'Acciones']} />
      <SkeletonTable title="Invitaciones pendientes de mi institución" columns={['Cuenta', 'Estado', 'Acciones']} />
      <SkeletonTable title="Solicitudes de mi institución" columns={['Correo', 'Nombres', 'Apellidos', 'Celular', 'Acción']} />
    </section>
  </section>;
}
