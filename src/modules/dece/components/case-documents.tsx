import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDeceData } from '../services/dece-data-context'

const bucket = 'dece-documents'
const maxBytes = 5 * 1024 * 1024
const formats = {
  pdf: { type: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  jpg: { type: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  png: { type: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47] },
} as const

type Extension = keyof typeof formats
type CaseDocument = {
  dece_document_id: string
  dece_case_id: string
  file_name: string
  file_path: string
  uploaded_by: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
  uploadedByName?: string
}

function permissionError(error: { code?: string; statusCode?: string } | null) {
  return error?.code === '42501' || error?.statusCode === '403'
}

function validObjectPath(path: string, institutionId: string, caseId: string) {
  const prefix = `${institutionId}/${caseId}/`
  return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpe?g|png)$/i.test(path.slice(prefix.length))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}

function sanitizeName(name: string, extension: Extension) {
  const basename = name.split(/[\\/]/).pop() ?? ''
  const stem = basename.slice(0, Math.max(0, basename.length - extension.length - 1))
    .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu, '_')
    .replace(/^\.+/, '').replace(/\s+/g, ' ').trim()
  const suffix = `.${extension}`
  const maxStem = 120 - suffix.length
  return `${Array.from(stem || 'documento').slice(0, maxStem).join('') || 'documento'}${suffix}`
}

async function validateFile(file: File): Promise<{ extension: Extension | null; error: string | null }> {
  if (!file.size) return { extension: null, error: 'El archivo está vacío.' }
  if (file.size > maxBytes) return { extension: null, error: 'El archivo supera el máximo permitido de 5 MB.' }
  const extension = file.name.split('.').pop()?.toLowerCase() as Extension | undefined
  if (!extension || !(extension in formats)) return { extension: null, error: 'Formato no permitido. Selecciona un PDF, JPG, JPEG o PNG.' }
  const expected = formats[extension]
  if (file.type !== expected.type) return { extension: null, error: 'La extensión y el tipo del archivo no coinciden. Selecciona un PDF, JPG, JPEG o PNG válido.' }
  const header = new Uint8Array(await file.slice(0, expected.signature.length).arrayBuffer())
  if (!expected.signature.every((byte, index) => header[index] === byte)) return { extension: null, error: 'El contenido del archivo no coincide con su formato. El archivo fue rechazado.' }
  return { extension, error: null }
}

export default function CaseDocuments({ caseId, caseInstitutionId }: { caseId: string; caseInstitutionId: string }) {
  const integration = useDeceData()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [documents, setDocuments] = useState<CaseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState<'upload' | 'download' | 'delete' | 'restore' | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CaseDocument | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (pendingDelete && dialog && !dialog.open) dialog.showModal()
    if (!pendingDelete && dialog?.open) dialog.close()
  }, [pendingDelete])

  async function loadList(includeDeleted = showDeleted) {
    if (!integration || caseInstitutionId !== integration.institutionId) {
      setError('No tienes permiso para consultar los documentos de este caso.')
      setLoading(false)
      return false
    }
    setLoading(true); setError('')
    try {
      let query = integration.client.from('dece_documents')
        .select('dece_document_id,dece_case_id,file_name,file_path,uploaded_by,created_at,deleted_at,deleted_by')
        .eq('dece_case_id', caseId)
        .order('created_at', { ascending: false })
      if (!includeDeleted) query = query.is('deleted_at', null)
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      const rows = (data ?? []) as CaseDocument[]
      const uploaderIds = [...new Set(rows.map(row => row.uploaded_by).filter((id): id is string => Boolean(id)))]
      let names = new Map<string, string>()
      if (uploaderIds.length) {
        const { data: profiles } = await integration.client.from('profiles').select('profile_id,first_name,last_name').in('profile_id', uploaderIds)
        if (profiles) names = new Map(profiles.map(profile => [profile.profile_id, `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()]))
      }
      setDocuments(rows.map(row => ({ ...row, uploadedByName: row.uploaded_by ? names.get(row.uploaded_by) : undefined })))
      setLoading(false)
      return true
    } catch (cause) {
      const issue = cause as { code?: string; statusCode?: string }
      setError(permissionError(issue) ? 'No tienes permiso para consultar los documentos de este caso.' : 'No se pudieron cargar los documentos del caso.')
      setDocuments([]); setLoading(false)
      return false
    }
  }

  useEffect(() => { void loadList() }, [integration, caseId, caseInstitutionId, showDeleted])

  async function logDocument(action: 'document.upload' | 'document.download', documentId: string) {
    if (!integration?.profileId) return false
    try {
      const { error: auditError } = await integration.client.from('audit_events').insert({
        institution_id: caseInstitutionId,
        profile_id: integration.profileId,
        action,
        entity_type: 'dece_document',
        entity_id: documentId,
        payload: { case_id: caseId },
      })
      return !auditError
    } catch { return false }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!integration || !file || busy) return
    if (caseInstitutionId !== integration.institutionId) { setError('No tienes permiso para subir documentos a este caso.'); return }
    setBusy(true); setOperation('upload'); setError(''); setMessage('Validando archivo…')
    try {
      const validation = await validateFile(file)
      if (validation.error) { setError(validation.error); setMessage(''); return }
      if (!integration.profileId) { setError('No se pudo identificar al usuario de la sesión. Inicia sesión nuevamente.'); setMessage(''); return }
      const extension = validation.extension!
      const fileName = sanitizeName(file.name, extension)
      const filePath = `${caseInstitutionId}/${caseId}/${crypto.randomUUID()}.${extension}`
      setMessage('Subiendo…')
      const storage = integration.client.storage.from(bucket)
      const { error: storageError } = await storage.upload(filePath, file, { contentType: formats[extension].type, upsert: false })
      if (storageError) throw Object.assign(new Error('storage'), { code: storageError.statusCode === '403' ? '42501' : storageError.statusCode })
      const { data: inserted, error: insertError } = await integration.client.from('dece_documents')
        .insert({ dece_case_id: caseId, file_name: fileName, file_path: filePath, uploaded_by: integration.profileId })
        .select('dece_document_id').single()
      if (insertError || !inserted) {
        const { error: cleanupError } = await storage.remove([filePath])
        if (cleanupError) throw Object.assign(new Error('rollback'), { code: insertError?.code, rollbackFailed: true })
        throw insertError ?? new Error('insert')
      }
      const auditOk = await logDocument('document.upload', inserted.dece_document_id)
      if (showDeleted) setShowDeleted(false)
      const refreshed = await loadList(false)
      if (fileInput.current) fileInput.current.value = ''
      setMessage(!refreshed ? 'El archivo se guardó, pero no se pudo actualizar la lista.' : !auditOk ? 'Documento guardado. No se pudo registrar la auditoría.' : 'Documento subido correctamente.')
    } catch (cause) {
      const issue = cause as { code?: string; statusCode?: string; rollbackFailed?: boolean }
      setMessage('')
      setError(issue.rollbackFailed
        ? 'No se pudo guardar el registro ni limpiar el archivo temporal. Contacta al administrador.'
        : permissionError(issue) ? 'No tienes permiso para subir documentos a este caso.' : 'No se pudo subir el documento. Inténtalo nuevamente.')
    } finally { setBusy(false); setOperation(null) }
  }

  async function openDocument(document: CaseDocument) {
    if (!integration || busy) return
    if (caseInstitutionId !== integration.institutionId) { setError('No tienes permiso para descargar este documento.'); return }
    if (!validObjectPath(document.file_path, caseInstitutionId, caseId)) { setError('La ruta almacenada del documento no es válida. Contacta al administrador.'); return }
    setBusy(true); setOperation('download'); setError(''); setMessage('Preparando descarga…')
    try {
      const { data, error: signedError } = await integration.client.storage.from(bucket).createSignedUrl(document.file_path, 60, { download: document.file_name })
      if (signedError || !data?.signedUrl) {
        throw Object.assign(new Error('signed-url'), { code: permissionError(signedError) ? '42501' : signedError?.statusCode, statusCode: signedError?.statusCode })
      }
      const response = await fetch(data.signedUrl)
      if (!response.ok) throw Object.assign(new Error('download'), { code: response.status === 403 ? '42501' : undefined })
      const blobUrl = URL.createObjectURL(await response.blob())
      const anchor = window.document.createElement('a')
      anchor.href = blobUrl; anchor.download = document.file_name; anchor.rel = 'noopener'; anchor.style.display = 'none'
      window.document.body.append(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      const auditOk = await logDocument('document.download', document.dece_document_id)
      setMessage(auditOk ? 'Descarga iniciada.' : 'Descarga iniciada. No se pudo registrar la auditoría.')
    } catch (cause) {
      const issue = cause as { code?: string; statusCode?: string }
      setMessage('')
      setError(permissionError(issue) ? 'No tienes permiso para descargar este documento.' : 'No se pudo preparar la descarga del documento.')
    } finally { setBusy(false); setOperation(null) }
  }

  async function setDeleted(document: CaseDocument, deleted: boolean) {
    if (!integration || busy || caseInstitutionId !== integration.institutionId) return
    if (!integration.profileId) { setError('No se pudo identificar al usuario de la sesión. Inicia sesión nuevamente.'); return }
    setBusy(true); setOperation(deleted ? 'delete' : 'restore'); setError(''); setMessage(deleted ? 'Eliminando…' : 'Restaurando…')
    try {
      let query = integration.client.from('dece_documents').update({
        deleted_at: deleted ? new Date().toISOString() : null,
        deleted_by: deleted ? integration.profileId : null,
      }).eq('dece_document_id', document.dece_document_id).eq('dece_case_id', caseId)
      query = deleted ? query.is('deleted_at', null) : query.not('deleted_at', 'is', null)
      const { data, error: updateError } = await query.select('dece_document_id').maybeSingle()
      if (updateError || !data) throw Object.assign(new Error('update'), { code: updateError?.code ?? '42501' })
      setPendingDelete(null)
      const refreshed = await loadList()
      setMessage(refreshed ? deleted ? 'Documento eliminado de la lista.' : 'Documento restaurado.' : deleted ? 'El documento se eliminó, pero no se pudo actualizar la lista.' : 'El documento se restauró, pero no se pudo actualizar la lista.')
    } catch (cause) {
      const issue = cause as { code?: string; statusCode?: string }
      setMessage('')
      setError(permissionError(issue) ? 'No tienes permiso para actualizar este documento.' : 'No se pudo actualizar el estado del documento.')
    } finally { setBusy(false); setOperation(null) }
  }

  const authorized = Boolean(integration && caseInstitutionId === integration.institutionId)

  return <section className="table-card p-3 mt-4" aria-labelledby="case-documents-title">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2"><h2 id="case-documents-title">Documentos</h2><label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={showDeleted} onChange={event => setShowDeleted(event.target.checked)} disabled={busy} /><span>Mostrar eliminados</span></label></div>
    {!authorized && <p role="alert">No tienes permiso para consultar los documentos de este caso.</p>}
    {authorized && <>
      <form className="row g-2 align-items-end mb-3" onSubmit={event => void upload(event)}>
        <div className="col-12 col-md-8"><label htmlFor={`case-document-file-${caseId}`} className="form-label">Selecciona un documento (PDF, JPG o PNG; máximo 5 MB)</label><input ref={fileInput} id={`case-document-file-${caseId}`} className="form-control" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby={`case-document-help-${caseId}`} disabled={busy} /><small id={`case-document-help-${caseId}`} className="form-text">Se valida el formato real del archivo antes de subirlo.</small></div>
        <div className="col-12 col-md-4"><button type="submit" className="btn btn-primary" disabled={busy}>{operation === 'upload' ? 'Subiendo…' : 'Subir documento'}</button></div>
      </form>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <p aria-live="polite" aria-atomic="true" role="status" className="visually-hidden">{message}</p>
      {loading ? <p role="status">Cargando documentos…</p> : error ? null : documents.length === 0 ? <p>Sin documentos</p> : <div className="table-responsive"><table className="table"><caption className="visually-hidden">Documentos del caso {caseId}</caption><thead><tr><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Fecha</th><th scope="col">Subido por</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{documents.map(document => {
        const image = /\.(jpe?g|png)$/i.test(document.file_name)
        return <tr key={document.dece_document_id} className={document.deleted_at ? 'text-secondary' : undefined}><td>{document.file_name}</td><td>{image ? 'Imagen' : 'PDF'}</td><td>{formatDate(document.created_at)}</td><td>{document.uploadedByName || ''}</td><td>{document.deleted_at ? `Eliminado · ${formatDate(document.deleted_at)}` : 'Activo'}</td><td>{document.deleted_at
          ? <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} aria-label={`Restaurar ${document.file_name}`} onClick={() => void setDeleted(document, false)}>Restaurar</button>
          : <div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} aria-label={`Descargar ${document.file_name}`} onClick={() => void openDocument(document)}>Descargar</button><button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} aria-label={`Eliminar ${document.file_name}`} onClick={() => setPendingDelete(document)}>Eliminar</button></div>}</td></tr>
      })}</tbody></table></div>}
    </>}
    <dialog ref={dialogRef} aria-labelledby={`delete-document-title-${caseId}`} className="rounded border-0 p-4 shadow" onClose={() => setPendingDelete(null)}><h3 id={`delete-document-title-${caseId}`}>Eliminar documento</h3><p>El documento dejará de mostrarse. El archivo se conserva en el sistema.</p><p>{pendingDelete?.file_name}</p><div className="d-flex gap-2"><button type="button" className="btn btn-danger" disabled={busy} onClick={() => pendingDelete && void setDeleted(pendingDelete, true)}>Confirmar eliminación</button><button type="button" className="btn btn-outline-secondary" onClick={() => setPendingDelete(null)}>Cancelar</button></div></dialog>
  </section>
}
