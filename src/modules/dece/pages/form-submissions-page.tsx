import { useEffect, useMemo, useState } from 'react'
import type { Student } from '../types'
import { useDeceData } from '../services/dece-data-context'
import { createDeceFormService } from '../services/form-service'
import PdfActionButton from '../components/pdf-action-button'

type SubmissionRow = { form_submission_id: string; student_id: string; form_version_id: string; status: 'draft' | 'submitted' | 'reviewed'; updated_at: string }
type FormMeta = { code: string; name: string; version: number }

export default function FormSubmissionsPage({ onOpen }: { onOpen: (student: Student, code: string) => void }) {
  const integration = useDeceData()
  const service = useMemo(() => integration ? createDeceFormService(integration.client) : null, [integration?.client])
  const [rows, setRows] = useState<Array<{ id: string; student: Student; form: FormMeta; status: SubmissionRow['status']; updatedAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formFilter, setFormFilter] = useState('all')
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'not-reviewed'>('all')
  const forms = useMemo(() => Array.from(new Map(rows.map(row => [row.form.code, row.form])).values()), [rows])
  const visibleRows = useMemo(() => rows.filter(row =>
    (formFilter === 'all' || row.form.code === formFilter)
    && (reviewFilter === 'all' || (reviewFilter === 'reviewed' ? row.status === 'reviewed' : row.status !== 'reviewed')),
  ), [formFilter, reviewFilter, rows])

  async function reopen(id: string) {
    if (!service) return
    setError('')
    try {
      await service.reopenSubmission(id)
      setRows(current => current.map(row => row.id === id ? { ...row, status: 'draft', updatedAt: new Date().toISOString() } : row))
    } catch (cause) {
      const issue = cause as { message?: string; code?: string }
      setError(issue.message ? `${issue.message}${issue.code ? ` (${issue.code})` : ''}` : 'No se pudo reabrir la ficha.')
    }
  }

  useEffect(() => {
    let live = true
    async function load() {
      if (!integration) return
      setLoading(true); setError('')
      try {
        const { data: definitionRows, error: definitionsError } = await integration.client.from('form_definitions')
          .select('form_definition_id, code, name').eq('institution_id', integration.institutionId)
        if (definitionsError) throw definitionsError
        const definitions = definitionRows ?? []
        const definitionIds = definitions.map(definition => definition.form_definition_id)
        if (!definitionIds.length) { if (live) setRows([]); return }
        const { data: versionRows, error: versionsError } = await integration.client.from('form_versions')
          .select('form_version_id, form_definition_id, version_number').in('form_definition_id', definitionIds)
        if (versionsError) throw versionsError
        const versions = versionRows ?? []
        const versionIds = versions.map(version => version.form_version_id)
        if (!versionIds.length) { if (live) setRows([]); return }
        const { data: submissionRows, error: submissionError } = await integration.client.from('form_submissions')
          .select('form_submission_id, student_id, form_version_id, status, updated_at').in('form_version_id', versionIds).order('updated_at', { ascending: false })
        if (submissionError) throw submissionError
        const submissions = (submissionRows ?? []) as SubmissionRow[]
        if (!submissions.length) { if (live) setRows([]); return }
        const studentIds = [...new Set(submissions.map(row => row.student_id))]
        const { data: studentRows, error: studentsError } = await integration.client.from('students')
          .select('student_id, institution_id, national_id, first_name, last_name, grade_level').eq('institution_id', integration.institutionId).in('student_id', studentIds)
        if (studentsError) throw studentsError
        const students = new Map((studentRows ?? []).map(row => [row.student_id, row]))
        const forms = new Map(definitions.map(definition => [definition.form_definition_id, definition]))
        const versionMap = new Map(versions.map(version => [version.form_version_id, version]))
        const mapped = submissions.flatMap(submission => {
          const studentRow = students.get(submission.student_id)
          const version = versionMap.get(submission.form_version_id)
          const definition = version && forms.get(version.form_definition_id)
          if (!studentRow || !version || !definition) return []
          const student: Student = {
            recordId: studentRow.student_id,
            id: studentRow.national_id ?? 'Sin identificación',
            name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
            firstName: studentRow.first_name,
            lastName: studentRow.last_name,
            grade: studentRow.grade_level ?? 'Sin grado',
            initials: studentRow.first_name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase(),
            color: 'lavender',
          }
      return [{ id: submission.form_submission_id, student, form: { code: definition.code, name: definition.name, version: version.version_number }, status: submission.status, updatedAt: submission.updated_at }]
        })
        if (live) setRows(mapped)
      } catch (cause) {
        const issue = cause as { message?: string; code?: string }
        if (live) setError(issue.message ? `${issue.message}${issue.code ? ` (${issue.code})` : ''}` : 'No se pudieron cargar los envíos de fichas.')
      } finally { if (live) setLoading(false) }
    }
    void load()
    return () => { live = false }
  }, [integration])

  return <div className="page-content container-fluid">
    <div className="eyebrow">GESTIÓN DECE</div><div className="welcome-row list-title"><div><h1>Envíos de fichas</h1><p className="subheading">Revisa, filtra y reabre respuestas recibidas.</p></div><div className="record-total"><b>{visibleRows.length}</b> envíos visibles</div></div>
    {loading && <p role="status">Cargando envíos…</p>}{error && <div className="notice sensitive" role="alert">{error}</div>}
    {!loading && rows.length === 0 && <div className="empty-state">Todavía no hay envíos de fichas.</div>}
    {rows.length > 0 && <><div className="toolbar d-flex flex-wrap mb-3"><label className="field"><span>Tipo de ficha</span><select className="form-select" value={formFilter} onChange={event => setFormFilter(event.target.value)}><option value="all">Todas las fichas</option>{forms.map(form => <option key={form.code} value={form.code}>{form.name}</option>)}</select></label><label className="field"><span>Estado de revisión</span><select className="form-select" value={reviewFilter} onChange={event => setReviewFilter(event.target.value as typeof reviewFilter)}><option value="all">Todos los estados</option><option value="reviewed">Revisadas</option><option value="not-reviewed">Sin revisar</option></select></label></div>
    {visibleRows.length === 0 ? <div className="empty-state">No hay envíos que coincidan con estos filtros.</div> : <div className="table-card table-responsive"><table className="table"><thead><tr><th>ESTUDIANTE</th><th>FICHA</th><th>VERSIÓN</th><th>ESTADO</th><th>ACTUALIZACIÓN</th><th>ACCIONES</th></tr></thead><tbody>
      {visibleRows.map(row => <tr key={row.id}><td><strong>{row.student.name}</strong><small className="d-block text-secondary">{row.student.grade} · {row.student.id}</small></td><td>{row.form.name}</td><td>{row.form.version}</td><td>{row.status === 'draft' ? 'Borrador' : row.status === 'submitted' ? 'Enviada' : 'Revisada'}</td><td>{new Date(row.updatedAt).toLocaleString('es-EC')}</td><td><button type="button" className="table-link me-3" onClick={() => onOpen(row.student, row.form.code)}>Revisar ficha</button><PdfActionButton label={`Descargar ficha llena de ${row.student.name}`} generate={async () => { const { createDecePdfService } = await import('../services/pdf-service'); await createDecePdfService(integration!.client).filledForm(integration!.institutionId, row.id, integration!.profileId) }} />{row.status === 'reviewed' && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void reopen(row.id)}>Reabrir para corrección</button>}</td></tr>)}
    </tbody></table></div>}
    </>}
  </div>
}
