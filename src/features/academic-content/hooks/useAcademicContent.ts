import { useEffect, useState } from 'react'
import { supabase } from '../../../core/supabaseClient'
import type { AcademicContentEntry, AcademicContentKind } from '../types/academicContent.types'
import { deleteAcademicContent, getAcademicContent, saveAcademicContent } from '../services/academicContentStorage'
import { createOfficialDistinctionsRepository, type HonorStudentOption } from '../../honors/services/officialDistinctionsRepository'
import { createNewsRepository } from '../services/newsRepository'
import { createEventRepository } from '../services/eventRepository'

const officialDistinctions = createOfficialDistinctionsRepository(supabase)
const newsRepository = createNewsRepository(supabase)
const eventRepository = createEventRepository(supabase)

export function useAcademicContent(kind: AcademicContentKind, institutionId: string | null) {
  const [entries, setEntries] = useState<AcademicContentEntry[]>([])
  const [students, setStudents] = useState<HonorStudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if ((kind === 'news' || kind === 'event') && institutionId) {
      const repository = kind === 'news' ? newsRepository : eventRepository
      void repository.list(institutionId).then(result => { if (active) { setEntries(result); setLoading(false) } }).catch(loadError => { if (active) { setEntries([]); setError(loadError instanceof Error ? loadError.message : `No se pudieron cargar los ${kind === 'news' ? 'noticias' : 'eventos'} desde Supabase.`); setLoading(false) } })
      return () => { active = false }
    }
    if (kind !== 'honor') {
      setEntries(getAcademicContent())
      setStudents([])
      setLoading(false)
      return () => { active = false }
    }
    if (!institutionId) {
      setEntries([])
      setStudents([])
      setError('Selecciona una institución para consultar sus distinciones oficiales.')
      setLoading(false)
      return () => { active = false }
    }
    void officialDistinctions.list(institutionId).then(result => {
      if (!active) return
      setEntries([...result.periods, ...result.entries])
      setStudents(result.students)
      setLoading(false)
    }).catch(loadError => {
      if (!active) return
      setEntries([])
      setStudents([])
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las distinciones desde Supabase.')
      setLoading(false)
    })
    return () => { active = false }
  }, [kind, institutionId, reloadVersion])

  const save = async (entry: AcademicContentEntry) => {
    if (kind === 'news' || kind === 'event') {
      if (!institutionId) throw new Error('Selecciona una institución antes de guardar.')
      const saved = kind === 'news' ? await newsRepository.save(entry, institutionId) : await eventRepository.save(entry, institutionId)
      setEntries(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
      return
    }
    if (kind !== 'honor') {
      setEntries(saveAcademicContent(entry))
      return
    }
    if (!institutionId) throw new Error('Selecciona una institución antes de guardar.')
    const saved = await officialDistinctions.save(entry, institutionId)
    setEntries(current => current.some(currentEntry => currentEntry.id === saved.id)
      ? current.map(currentEntry => currentEntry.id === saved.id ? saved : currentEntry)
      : [...current, saved])
    setError('')
  }

  const remove = async (id: string) => {
    if (kind === 'news' || kind === 'event') {
      if (!institutionId) throw new Error('Selecciona una institución antes de eliminar.')
      if (kind === 'news') await newsRepository.remove(id, institutionId)
      else await eventRepository.remove(id, institutionId)
      setEntries(current => current.filter(item => item.id !== id))
      return
    }
    if (kind !== 'honor') {
      setEntries(deleteAcademicContent(id))
      return
    }
    if (!institutionId) throw new Error('Selecciona una institución antes de eliminar.')
    await officialDistinctions.remove(id, institutionId)
    setEntries(current => current.filter(entry => entry.id !== id))
  }

  return { entries, students, loading, error, reload: () => setReloadVersion(value => value + 1), save, remove }
}
