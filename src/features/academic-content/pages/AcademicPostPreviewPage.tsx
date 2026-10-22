import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUp, CalendarDays, ImagePlus, MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import authorAvatar from '../../honors/mocks/avatars/portrait-01.jpg'
import type { AcademicContentEntry, AcademicContentSection } from '../types/academicContent.types'
import { getAcademicContentSections } from '../utils/contentSections'
import './AcademicPostPreviewPage.css'

const DEFAULT_AUTHOR = 'Brigitte Rodríguez'
interface PeriodOption { id: string; title: string }
interface Props {
  entry: AcademicContentEntry
  mode?: 'preview' | 'edit'
  isNew?: boolean
  periods?: PeriodOption[]
  onChange?: (entry: AcademicContentEntry) => void
  onSave?: (entry: AcademicContentEntry) => void
  onCancel?: () => void
  onBack?: () => void
}

function dateLabel(value: string) {
  if (!value) return 'Fecha por definir'
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

async function imageFileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar la imagen.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.78)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function AcademicPostPreviewPage({ entry, mode = 'preview', isNew = false, periods = [], onChange, onSave, onCancel, onBack }: Props) {
  const isEditing = mode === 'edit'
  const isEvent = entry.kind === 'event'
  const author = DEFAULT_AUTHOR
  const fallbackImage = isEvent
    ? 'https://socialsciences.careers.mcmaster.ca/app/uploads/2025/10/Untitled-design-27.png'
    : 'https://futuresocsci.mcmaster.ca/app/uploads/2024/07/Thubnail-photo-2-1400x600.jpg'
  const sourceSections = useMemo(() => getAcademicContentSections(entry), [entry])
  const sections = isEditing && sourceSections.length === 0
    ? [{ id: `section-${entry.id}-new`, title: '', blocks: [{ id: `paragraph-${entry.id}-new`, type: 'paragraph' as const, text: '' }] }]
    : sourceSections
  const articleSections = !isEditing && sourceSections.length === 0 && entry.sourceName
    ? [{ id: `source-${entry.id}`, title: 'Fuente y contexto', blocks: [] }]
    : sections
  const [activeSection, setActiveSection] = useState(0)
  const [formError, setFormError] = useState('')
  const [imageError, setImageError] = useState('')
  const [editingTitle, setEditingTitle] = useState(true)
  const [editingSummary, setEditingSummary] = useState(true)
  const [editingItems, setEditingItems] = useState<string[]>(sections.flatMap(section => [section.id, ...section.blocks.map(block => block.id)]))

  useEffect(() => {
    if (isEditing || !articleSections.length) return
    const observer = new IntersectionObserver(items => {
      const visible = items.filter(item => item.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const index = visible ? articleSections.findIndex(section => `post-section-${section.id}` === visible.target.id) : -1
      if (index >= 0) setActiveSection(index)
    }, { rootMargin: '-15% 0px -65% 0px', threshold: [0, 0.2, 0.6] })
    articleSections.forEach(section => {
      const target = document.getElementById(`post-section-${section.id}`)
      if (target) observer.observe(target)
    })
    return () => observer.disconnect()
  }, [entry.id, isEditing, articleSections])

  const updateEntry = (patch: Partial<AcademicContentEntry>) => onChange?.({ ...entry, ...patch })
  const updateSection = (index: number, patch: Partial<AcademicContentSection>) => {
    const next = sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section)
    updateEntry({ sections: next })
  }
  const addSection = () => {
    const sectionId = crypto.randomUUID()
    const paragraphId = crypto.randomUUID()
    updateEntry({ sections: [...sections, { id: sectionId, title: '', blocks: [{ id: paragraphId, type: 'paragraph', text: '' }] }] })
    setEditingItems(items => [...items, sectionId, paragraphId])
  }
  const removeSection = (index: number) => updateEntry({ sections: sections.filter((_, sectionIndex) => sectionIndex !== index) })
  const addBlock = (sectionIndex: number, type: 'paragraph' | 'image') => {
    const section = sections[sectionIndex]
    const block = type === 'paragraph'
      ? { id: crypto.randomUUID(), type, text: '' } as const
      : { id: crypto.randomUUID(), type, src: '', alt: '', caption: '' } as const
    updateSection(sectionIndex, { blocks: [...section.blocks, block] })
    setEditingItems(items => [...items, block.id])
  }
  const updateBlock = (sectionIndex: number, blockIndex: number, patch: Record<string, string>) => {
    const section = sections[sectionIndex]
    const blocks = section.blocks.map((block, index) => index === blockIndex ? { ...block, ...patch } : block)
    updateSection(sectionIndex, { blocks })
  }
  const removeBlock = (sectionIndex: number, blockIndex: number) => {
    const section = sections[sectionIndex]
    updateSection(sectionIndex, { blocks: section.blocks.filter((_, index) => index !== blockIndex) })
  }
  const uploadImage = async (file: File | undefined, onImage: (dataUrl: string) => void) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setImageError('Selecciona un archivo de imagen.'); return }
    try { onImage(await imageFileToDataUrl(file)); setImageError('') }
    catch { setImageError('No se pudo cargar esta foto. Inténtalo con otra imagen.') }
  }
  const saveEntry = () => {
    const hasContent = sections.some(section => section.blocks.some(block => block.type === 'image' ? block.src.trim() : block.text.trim()))
    if (!entry.title.trim()) { setFormError('Escribe el título de la publicación.'); return }
    if (!hasContent) { setFormError('Agrega al menos un párrafo o una foto.'); return }
    setFormError('')
    onSave?.({ ...entry, author: DEFAULT_AUTHOR, sections })
  }

  return <section className={`post-preview-page page-content${isEditing ? ' is-editing' : ''}`}>
    {isEditing && <div className="post-editor-toolbar"><button type="button" className="post-editor-back" onClick={onCancel}><ArrowLeft size={17} />Cancelar</button><span>{isNew ? 'Nueva publicación' : 'Editar publicación'}</span><button type="button" className="post-editor-save" onClick={saveEntry}><Save size={17} />Guardar</button></div>}
    {!isEditing && onBack && <div className="post-reader-toolbar"><button type="button" onClick={onBack}><ArrowLeft size={17} />Volver a noticias</button></div>}
    <article className={`post-article${isEditing ? ' is-editing' : ''}`}>
      <div className="post-cover-wrap">
        <img className="post-article-cover" src={entry.imageUrl || fallbackImage} alt={isEditing ? 'Portada de la publicación' : 'Foto de portada'} />
        {isEditing && <label className="post-cover-edit-icon" title="Cambiar portada"><Pencil size={17} /><input aria-label="Cambiar portada" type="file" accept="image/*" onChange={event => void uploadImage(event.target.files?.[0], imageUrl => updateEntry({ imageUrl }))} /></label>}
      </div>
      <div className="post-article-content">
        {isEditing ? <div className="post-edit-fields">
          <div className="post-inline-edit-row">{editingTitle ? <input aria-label="Título" className="post-title-input" maxLength={160} value={entry.title} onChange={event => updateEntry({ title: event.target.value })} onBlur={() => setEditingTitle(false)} placeholder="Título de la publicación" autoFocus /> : <h1>{entry.title || 'Título de la publicación'}</h1>}<button type="button" className="post-pencil-button" aria-label="Editar título" onClick={() => setEditingTitle(true)}><Pencil size={16} /></button></div>
          <div className="post-inline-edit-row">{editingSummary ? <textarea aria-label="Resumen" rows={2} value={entry.description} onChange={event => updateEntry({ description: event.target.value })} onBlur={() => setEditingSummary(false)} placeholder="Escribe un resumen breve" autoFocus /> : <p className="post-article-summary">{entry.description || 'Agrega un resumen breve para presentar la noticia.'}</p>}<button type="button" className="post-pencil-button" aria-label="Editar resumen" onClick={() => setEditingSummary(true)}><Pencil size={16} /></button></div>
          <div className="post-publishing-fields"><label>{isEvent ? 'Fecha del evento' : 'Fecha de publicación'}<input type="date" value={entry.date} onChange={event => updateEntry({ date: event.target.value })} /></label>{isEvent && <label>Hora<input type="time" value={entry.time ?? ''} onChange={event => updateEntry({ time: event.target.value })} /></label>}</div>
          <details className="post-more-options">
            <summary>Opciones de publicación</summary>
          <div className="post-metadata-edit-grid">
            <label>Estado<select value={entry.status} onChange={event => updateEntry({ status: event.target.value as AcademicContentEntry['status'] })}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
            <label>Año lectivo<select value={entry.periodId} onChange={event => updateEntry({ periodId: event.target.value })}><option value="">Sin período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}</option>)}</select></label>
            {isEvent && <label>Lugar<input value={entry.location} onChange={event => updateEntry({ location: event.target.value })} placeholder="Lugar del evento" /></label>}
            <label>Fuente<input value={entry.sourceName ?? ''} onChange={event => updateEntry({ sourceName: event.target.value })} placeholder="Nombre de la fuente" /></label>
            <label>Enlace de la fuente<input type="url" value={entry.sourceUrl ?? ''} onChange={event => updateEntry({ sourceUrl: event.target.value })} placeholder="https://" /></label>
          </div>
          <div className="post-automatic-meta"><span>Autor: {author}</span><span>Fecha: {dateLabel(entry.date)}</span></div>
          </details>
        </div> : <>
          <p className="post-article-category">{isEvent ? 'EVENTO INSTITUCIONAL' : 'NOTICIAS'}</p>
          <h1>{entry.title}</h1>
          <div className="post-article-meta">
            <span className="post-author"><img className="post-author-avatar" src={authorAvatar} alt="" /><span className="post-author-name">{author}</span></span>
            <span><CalendarDays size={16} />{dateLabel(entry.date)}</span>
            {isEvent && entry.time && <span>{entry.time}</span>}
            {entry.sourceName && <span>Fuente: {entry.sourceUrl && /^https?:\/\//i.test(entry.sourceUrl) ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceName}</a> : entry.sourceName}</span>}
            {isEvent && entry.location && <span><MapPin size={16} />{entry.location}</span>}
          </div>
          {entry.description && <p className="post-article-summary">{entry.description}</p>}
        </>}
        <div className="post-article-layout">
          <div className="post-article-body">
            {articleSections.map((section, sectionIndex) => <section id={`post-section-${section.id}`} className={`post-article-section${isEditing ? ' is-editing-section' : ''}`} key={section.id}>
              {isEditing ? <div className="post-section-heading-editor">{editingItems.includes(section.id) ? <input aria-label={`Título de la sección ${sectionIndex + 1}`} value={section.title} onChange={event => updateSection(sectionIndex, { title: event.target.value })} onBlur={() => setEditingItems(items => items.filter(id => id !== section.id))} placeholder={`Título de sección ${sectionIndex + 1}`} autoFocus /> : <h2>{section.title || `Sección ${sectionIndex + 1}`}</h2>}<button type="button" className="post-pencil-button" onClick={() => setEditingItems(items => [...items, section.id])} aria-label="Editar título de sección"><Pencil size={15} /></button><button type="button" onClick={() => removeSection(sectionIndex)} aria-label={`Eliminar sección ${sectionIndex + 1}`} title="Eliminar sección"><Trash2 size={16} /></button></div> : section.title && <h2>{section.title}</h2>}
              {section.blocks.map((block, blockIndex) => block.type === 'paragraph' ? isEditing
                ? <div className="post-paragraph-editor" key={block.id}>{editingItems.includes(block.id) ? <textarea aria-label={`Párrafo ${blockIndex + 1} de ${section.title || 'la sección'}`} rows={3} value={block.text} onChange={event => updateBlock(sectionIndex, blockIndex, { text: event.target.value })} onBlur={() => setEditingItems(items => items.filter(id => id !== block.id))} placeholder="Escribe un párrafo" autoFocus /> : <p>{block.text || 'Escribe un párrafo…'}</p>}<button type="button" className="post-pencil-button" onClick={() => setEditingItems(items => [...items, block.id])} aria-label="Editar párrafo"><Pencil size={15} /></button><button type="button" onClick={() => removeBlock(sectionIndex, blockIndex)} aria-label="Eliminar párrafo"><X size={15} /></button></div>
                : block.text && <p key={block.id}>{block.text}</p>
                : isEditing
                  ? <div className="post-image-block-editor" key={block.id}>
                    {block.src ? <img src={block.src} alt={block.alt || 'Foto de la publicación'} /> : <div className="post-image-empty"><ImagePlus size={20} />Agrega una foto</div>}
                    <div className="post-inline-photo-actions"><span className="post-photo-status">{block.src ? 'Foto lista' : 'Elige una foto'}</span><label className="post-file-picker"><ImagePlus size={16} />{block.src ? 'Cambiar foto' : 'Elegir foto'}<input aria-label="Elegir foto para la sección" type="file" accept="image/*" onChange={event => void uploadImage(event.target.files?.[0], imageUrl => updateBlock(sectionIndex, blockIndex, { src: imageUrl }))} /></label></div>
                    <details className="post-photo-details"><summary>Detalles de la foto</summary><label>Texto alternativo<input value={block.alt} onChange={event => updateBlock(sectionIndex, blockIndex, { alt: event.target.value })} placeholder="Describe la foto" /></label><label>Pie de foto<input value={block.caption} onChange={event => updateBlock(sectionIndex, blockIndex, { caption: event.target.value })} placeholder="Pie de foto (opcional)" /></label></details>
                    <button className="post-block-remove" type="button" onClick={() => removeBlock(sectionIndex, blockIndex)}><Trash2 size={15} />Quitar foto</button>
                  </div>
                  : block.src && <figure className="post-article-figure" key={block.id}><img src={block.src} alt={block.alt || 'Foto de la publicación'} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>)}
              {!isEditing && section.id === `source-${entry.id}` && entry.sourceName && <><p>Esta noticia fue publicada originalmente por {entry.sourceName}.</p>{entry.sourceUrl && /^https?:\/\//i.test(entry.sourceUrl) && <p><a href={entry.sourceUrl} target="_blank" rel="noreferrer">Consultar la publicación original</a></p>}</>}
              {isEditing && <div className="post-section-actions"><button type="button" onClick={() => addBlock(sectionIndex, 'paragraph')}><Plus size={15} />Agregar párrafo</button><button type="button" onClick={() => addBlock(sectionIndex, 'image')}><ImagePlus size={15} />Agregar foto</button>{sectionIndex > 0 && <button type="button" onClick={() => updateEntry({ sections: sections.map((item, index) => index === sectionIndex ? sections[sectionIndex - 1] : index === sectionIndex - 1 ? sections[sectionIndex] : item) })} aria-label="Mover sección arriba" title="Mover sección arriba"><ArrowUp size={15} />Mover arriba</button>}</div>}
            </section>)}
            {isEditing && <button type="button" className="post-add-section" onClick={addSection}><Plus size={17} />Agregar sección</button>}
          </div>
          {!isEditing && articleSections.length > 0 && <nav className="post-article-toc" aria-label="Secciones del artículo"><strong>En este artículo</strong>{articleSections.map((section, index) => <a key={section.id} href={`#post-section-${section.id}`} className={activeSection === index ? 'is-active' : ''} aria-current={activeSection === index ? 'location' : undefined}>{section.title || `Sección ${index + 1}`}</a>)}</nav>}
        </div>
        {imageError && <p className="post-editor-error" role="alert">{imageError}</p>}
        {formError && <p className="post-editor-error" role="alert">{formError}</p>}
        {isEditing && <div className="post-editor-bottom-actions"><button type="button" className="post-editor-back" onClick={onCancel}>Cancelar</button><button type="button" className="post-editor-save" onClick={saveEntry}><Save size={17} />Guardar</button></div>}
      </div>
    </article>
  </section>
}
