import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import type { DeceScreen, Student } from '../../types'
import { StudentName } from '../../components/student-name'

type Props = {
  data: Student[]
  query: string
  setQuery: (query: string) => void
  grade: string
  setGrade: (grade: string) => void
  onOpen: (student: Student, target: DeceScreen) => void
}

const grades = ['7.º EGB', '8.º EGB', '9.º EGB', '10.º EGB']

export default function StudentDirectoryPage({
  data,
  query,
  setQuery,
  grade,
  setGrade,
  onOpen,
}: Props) {
  return (
    <div className="page-content container-fluid">
      <div className="eyebrow">GESTIÓN DECE</div>
      <div className="welcome-row list-title">
        <div>
          <h1>Estudiantes</h1>
          <p className="subheading">
            Consulta la información y las fichas de cada estudiante.
          </p>
        </div>
        <div className="record-total">
          <b>{data.length}</b> registros visibles
        </div>
      </div>
      <section className="table-card directory" aria-label="Directorio de estudiantes">
        <div className="toolbar d-flex flex-wrap">
          <label className="search-box">
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            <input
              className="form-control"
              aria-label="Buscar estudiante"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por nombre o identificación..."
            />
          </label>
          <select
            className="form-select"
            aria-label="Filtrar por grado"
            value={grade}
            onChange={event => setGrade(event.target.value)}
          >
            <option>Todos los grados</option>
            {grades.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="table-scroll table-responsive student-table-view">
          <table className="table">
            <caption className="visually-hidden">Directorio de estudiantes</caption>
            <thead>
              <tr>
                <th scope="col">ESTUDIANTE</th>
                <th scope="col">IDENTIFICACIÓN</th>
                <th scope="col">GRADO / NIVEL</th>
                <th scope="col">FICHA GENERAL</th>
                <th scope="col">AUTORIZACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {data.map(student => (
                <tr key={student.id}>
                  <td><StudentName student={student} /></td>
                  <td>{student.id}</td>
                  <td><span className="grade-pill">{student.grade}</span></td>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => onOpen(student, 'general')}
                    >
                      Ver ficha <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => onOpen(student, 'authorization')}
                    >
                      Ver ficha <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="empty-state">
              No encontramos estudiantes con esos criterios.
            </div>
          )}
        </div>
        <div className="student-card-view" aria-label="Estudiantes">
          {data.map(student => (
            <article className="student-card" key={student.id}>
              <h2>{student.name}</h2>
              <dl>
                <div><dt>Identificación</dt><dd>{student.id}</dd></div>
                <div><dt>Grado / nivel</dt><dd>{student.grade}</dd></div>
              </dl>
              <div className="student-card-actions">
                <button type="button" className="table-link" onClick={() => onOpen(student, 'general')}>
                  Abrir ficha general
                </button>
                <button type="button" className="table-link" onClick={() => onOpen(student, 'authorization')}>
                  Abrir autorización
                </button>
              </div>
            </article>
          ))}
          {data.length === 0 && (
            <div className="empty-state">No encontramos estudiantes con esos criterios.</div>
          )}
        </div>
        <div className="table-bottom">
          Mostrando {data.length} estudiantes
          <span>Datos demostrativos</span>
        </div>
      </section>
      <footer className="page-footer">
        Los datos de esta vista son ficticios y se usan únicamente para demostración.
      </footer>
    </div>
  )
}
