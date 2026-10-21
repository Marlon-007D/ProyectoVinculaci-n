import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, FolderKanban, Image, Pencil, Plus, Save, Search, Tag, Trash2, X } from 'lucide-react'
import type { SchoolModule, SchoolSubject } from '../../courses/types/courseCatalog.types'
import { useCourseCategories } from '../../courses/hooks/useCourseCategories'
import { useSchoolCourses } from '../../courses/hooks/useSchoolCourses'
import { useTenant } from '../../../core/TenantContext'
import { saveCourseCategories } from '../../courses/services/courseCategoriesStore'
import styles from './AdminCourseCategoriesPage.module.css'

const pageSize = 5
const categoryIcons = [
  ['sigma', 'Matemática'], ['laptop', 'Tecnología'], ['languages', 'Idiomas'],
  ['flask', 'Ciencias'], ['palette', 'Arte'], ['atom', 'Átomo'],
  ['book', 'Libro'], ['chart', 'Gráfico'], ['landmark', 'Sociedad'],
  ['dumbbell', 'Deporte'], ['lightbulb', 'Ideas'], ['ruler', 'Medición'],
] as const

type CategoryDraft = Omit<SchoolModule, 'id'> & { id: string | null }

function emptyDraft(): CategoryDraft {
  return { id: null, name: '', description: '', courseIds: [], icon: 'book', coverImage: '' }
}

function normalize(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function categoryCover(category: SchoolModule, courses: SchoolSubject[]) {
  return category.coverImage || courses.find(course => course.id === category.courseIds[0])?.coverImage || ''
}

export function AdminCourseCategoriesPage() {
  const { categories } = useCourseCategories()
  const { courses } = useSchoolCourses()
  const { activeInstitution } = useTenant()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [formError, setFormError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const filteredCategories = useMemo(() => {
    const query = normalize(search)
    return categories.filter(category => {
      if (categoryFilter !== 'all' && category.id !== categoryFilter) return false
      if (!query) return true
      const courseNames = category.courseIds.map(id => courses.find(course => course.id === id)?.name ?? '').join(' ')
      return normalize(`${category.name} ${category.description} ${courseNames}`).includes(query)
    })
  }, [categories, categoryFilter, search, courses])

  const pageCount = Math.max(1, Math.ceil(filteredCategories.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const startNewCategory = () => {
    setDraft(emptyDraft())
    setFormError('')
    setFormOpen(true)
  }

  const startEditing = (category: SchoolModule) => {
    setDraft({ ...category, courseIds: [...category.courseIds] })
    setFormError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = draft.name.trim()
    const description = draft.description.trim()
    if (!name || !description) {
      setFormError('Completa el nombre y la descripción de la categoría.')
      return
    }

    const duplicate = categories.some(category => category.id !== draft.id && normalize(category.name) === normalize(name))
    if (duplicate) {
      setFormError('Ya existe una categoría con ese nombre.')
      return
    }

    const category: SchoolModule = {
      ...draft,
      id: draft.id ?? `categoria-${crypto.randomUUID()}`,
      name,
      description,
      coverImage: draft.coverImage.trim(),
      courseIds: [...new Set(draft.courseIds)],
    }

    try {
      const next = draft.id
        ? categories.map(item => item.id === draft.id ? category : item)
        : [...categories, category]
      if (!activeInstitution) throw new Error('No hay institución activa.')
      await saveCourseCategories(activeInstitution.institution_id, next)
      setPage(1)
      setFormOpen(false)
      setDraft(emptyDraft())
    } catch {
      setFormError('No se pudo guardar en la base de datos. Revisa tu conexión y permisos.')
    }
  }

  const deleteCategory = async (category: SchoolModule) => {
    try {
      if (!activeInstitution) throw new Error('No hay institución activa.')
      await saveCourseCategories(activeInstitution.institution_id, categories.filter(item => item.id !== category.id))
      setPendingDeleteId(null)
      setDeleteError('')
    } catch {
      setDeleteError('No se pudo eliminar la categoría de la base de datos.')
    }
  }

  const toggleCourse = (courseId: string) => {
    setDraft(current => ({
      ...current,
      courseIds: current.courseIds.includes(courseId)
        ? current.courseIds.filter(id => id !== courseId)
        : [...current.courseIds, courseId],
    }))
  }

  return <main className={styles.page}>
    {formOpen && <section className={styles.formCard} aria-labelledby="category-form-title">
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>{draft.id ? 'Editar' : 'Crear'}</p>
          <h2 id="category-form-title"><span className={styles.formTitleIcon}><FolderKanban size={19} /></span>{draft.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario"><X size={19} /></button>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.formFields}>
          <label className={styles.field}><span className={styles.fieldLabel}><Tag size={15} />Nombre</span>
            <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} maxLength={80} placeholder="Ej. Ciencias y sociedad" required />
          </label>
          <label className={styles.field}>Icono
            <select value={draft.icon} onChange={event => setDraft(current => ({ ...current, icon: event.target.value }))}>
              {categoryIcons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={`${styles.field} ${styles.wideField}`}>Descripción
            <textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} maxLength={240} rows={2} placeholder="Describe brevemente esta categoría" required />
          </label>
          <label className={`${styles.field} ${styles.wideField}`}><span className={styles.fieldLabel}><Image size={15} />Imagen de portada (URL)</span>
            <input type="url" value={draft.coverImage} onChange={event => setDraft(current => ({ ...current, coverImage: event.target.value }))} placeholder="Vacío para usar la imagen del primer curso" />
          </label>
        </div>
        <fieldset className={styles.coursePicker}>
          <legend>Cursos dentro de esta categoría</legend>
          <div className={styles.courseOptions}>
            {courses.map(course => <label key={course.id} className={styles.courseOption}>
              <input type="checkbox" checked={draft.courseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} />
              <span>{course.name}</span>
            </label>)}
          </div>
        </fieldset>
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => setFormOpen(false)}>Cancelar</button>
          <button className={styles.primaryButton} type="submit"><Save size={17} />Guardar categoría</button>
        </div>
      </form>
    </section>}

    <section className={styles.listCard} aria-labelledby="category-list-title">
      {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}
      <div className={styles.listHeading}>
        <div>
          <h2 id="category-list-title">Categorías de cursos</h2>
          <p>{categories.length} {categories.length === 1 ? 'categoría' : 'categorías'} en el catálogo</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={startNewCategory}><Plus size={18} />Nueva categoría</button>
      </div>
      <div className={styles.filters}>
        <label className={styles.searchBox}>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar categoría o curso" aria-label="Buscar categoría o curso" />
        </label>
        <label className={styles.filterSelect}>Categoría
          <select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1) }}>
            <option value="all">Todas las categorías</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Categoría</th><th scope="col">Cursos</th><th scope="col">Portada</th><th scope="col"><span className={styles.srOnly}>Acciones</span></th></tr></thead>
          <tbody>
            {visibleCategories.map(category => <tr key={category.id}>
              <td><span className={styles.categoryName}>{category.name}</span><span className={styles.categoryDescription}>{category.description}</span></td>
              <td>{category.courseIds.length} {category.courseIds.length === 1 ? 'curso' : 'cursos'}</td>
              <td>{categoryCover(category, courses) ? <img className={styles.coverThumb} src={categoryCover(category, courses)} alt={`Portada de ${category.name}`} /> : <span className={styles.noCover}>Sin portada</span>}</td>
              <td>{pendingDeleteId === category.id ? <div className={styles.deleteConfirm}><span>¿Eliminar?</span><button type="button" onClick={() => setPendingDeleteId(null)}>Cancelar</button><button type="button" onClick={() => deleteCategory(category)}>Sí</button></div> : <div className={styles.rowActions}><button className={styles.iconButton} type="button" onClick={() => startEditing(category)} aria-label={`Editar ${category.name}`} title="Editar"><Pencil size={17} /></button><button className={`${styles.iconButton} ${styles.deleteButton}`} type="button" onClick={() => { setPendingDeleteId(category.id); setDeleteError('') }} aria-label={`Eliminar ${category.name}`} title="Eliminar"><Trash2 size={17} /></button></div>}</td>
            </tr>)}
            {visibleCategories.length === 0 && <tr><td className={styles.empty} colSpan={4}>No hay categorías que coincidan con la búsqueda.</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className={styles.pagination}>
        <span>{filteredCategories.length === 0 ? '0 resultados' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredCategories.length)} de ${filteredCategories.length}`}</span>
        <div className={styles.pageControls}>
          <span>Página {currentPage} de {pageCount}</span>
          <button className={styles.pageButton} type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Página anterior"><ChevronLeft size={18} /></button>
          <button className={styles.pageButton} type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Página siguiente"><ChevronRight size={18} /></button>
        </div>
      </footer>
    </section>
  </main>
}
