import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
  faFileLines,
  faHeartPulse,
  faPlus,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { students, dashboardStats } from '../../data'
import type { DeceScreen, Student } from '../../types'
import { StudentName, SummaryCard } from '../../components'

type Props = {
  onList: () => void
  onOpen: (student: Student, target: DeceScreen) => void
}

export default function DashboardPage({ onList, onOpen }: Props) {
  return (
    <div className="page-content container-fluid">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL</div>
          <h1>Panel DECE</h1>
          <p className="subheading">
            Un vistazo al acompañamiento y bienestar estudiantil.
          </p>
        </div>
        <button className="button btn primary" onClick={onList}>
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          <span>Ver estudiantes</span>
        </button>
      </div>
      <div className="summary-grid row g-3">
        {dashboardStats.map(stat => <SummaryCard key={stat.label} {...stat} />)}
      </div>
      <div className="section-heading">
        <div>
          <h2>Accesos rápidos</h2>
          <p>Continúa con una tarea frecuente.</p>
        </div>
      </div>
      <div className="quick-grid row g-3">
        <button className="quick-card col-12 col-md-4" onClick={onList}>
          <span className="quick-icon violet">
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
          </span>
          <b>Directorio de estudiantes</b>
          <small>Busca y consulta las fichas</small>
          <span className="arrow">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </span>
        </button>
        <button className="quick-card col-12 col-md-4" onClick={() => onOpen(students[0], 'general')}>
          <span className="quick-icon green">
            <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
          </span>
          <b>Ficha general acumulativa</b>
          <small>Información familiar y académica</small>
          <span className="arrow">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </span>
        </button>
        <button className="quick-card col-12 col-md-4" onClick={() => onOpen(students[0], 'authorization')}>
          <span className="quick-icon orange">
            <FontAwesomeIcon icon={faHeartPulse} aria-hidden="true" />
          </span>
          <b>Ficha de autorización</b>
          <small>Atención y emergencias</small>
          <span className="arrow">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </span>
        </button>
      </div>
      <div className="section-heading recent-heading">
        <div>
          <h2>Estudiantes recientes</h2>
          <p>Accede a sus fichas para continuar.</p>
        </div>
        <button className="text-button" onClick={onList}>
          Ver directorio <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
        </button>
      </div>
      <div className="table-card table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>ESTUDIANTE</th>
              <th>IDENTIFICACIÓN</th>
              <th>GRADO / NIVEL</th>
              <th>FICHAS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.slice(0, 3).map(student => (
              <tr key={student.id}>
                <td><StudentName student={student} /></td>
                <td>{student.id}</td>
                <td><span className="grade-pill">{student.grade}</span></td>
                <td><span className="status-dot" />En proceso</td>
                <td>
                  <button
                    className="row-action"
                    aria-label={`Abrir ficha de ${student.name}`}
                    onClick={() => onOpen(student, 'general')}
                  >
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="page-footer">
        DECE · Herramienta de apoyo para el acompañamiento estudiantil
      </footer>
    </div>
  )
}
