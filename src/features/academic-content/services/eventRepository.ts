import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcademicContentEntry } from '../types/academicContent.types'

interface EventRow { event_id: string; institution_id: string; title: string; description: string | null; event_date: string; location: string | null }

export function createEventRepository(client: SupabaseClient) {
  return {
    async list(institutionId: string) {
      const { data, error } = await client.from('events').select('event_id,institution_id,title,description,event_date,location').eq('institution_id', institutionId).order('event_date', { ascending: false })
      if (error) throw error
      return ((data ?? []) as EventRow[]).map(toEntry)
    },
    async save(entry: AcademicContentEntry, institutionId: string) {
      const localDateTime = `${entry.date}T${entry.time || '12:00'}:00-05:00`
      const eventDate = new Date(localDateTime)
      if (Number.isNaN(eventDate.getTime())) throw new Error('La fecha u hora del evento no es válida.')
      const payload = { event_id: entry.id, institution_id: institutionId, title: entry.title.trim(), description: entry.description.trim() || null, event_date: eventDate.toISOString(), location: entry.location.trim() || null }
      const { data, error } = await client.from('events').upsert(payload, { onConflict: 'event_id' }).select('event_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se guardó el evento. Verifica el acceso de esta institución.')
      return toEntry({ ...payload, event_id: data.event_id })
    },
    async remove(id: string, institutionId: string) {
      const { data, error } = await client.from('events').delete().eq('event_id', id).eq('institution_id', institutionId).select('event_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se encontró el evento o no tienes permiso para eliminarlo.')
    },
  }
}

function toEntry(row: EventRow): AcademicContentEntry {
  const value = new Date(row.event_date)
  const dateParts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: string) => dateParts.find(item => item.type === type)?.value ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(row.event_date)
    ? row.event_date
    : `${part('year')}-${part('month')}-${part('day')}`
  const time = /^\d{4}-\d{2}-\d{2}$/u.test(row.event_date)
    ? undefined
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value)
  return { id: row.event_id, institutionId: row.institution_id, kind: 'event', title: row.title, description: row.description ?? '', periodId: '', status: 'published', date, time, location: row.location ?? '', studentName: '', grade: '', distinction: '', startDate: '', endDate: '', isCurrent: false, updatedAt: row.event_date }
}
