import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcademicContentEntry } from '../types/academicContent.types'
import { parseNewsContent, serializeNewsContent } from './newsContentCodec'

interface NewsRow {
  news_id: string
  institution_id: string
  academic_period_id: string | null
  title: string
  slug: string
  summary: string | null
  content: string
  cover_image_url: string | null
  published_at: string | null
  is_published: boolean
}

export function createNewsRepository(client: SupabaseClient) {
  return {
    async list(institutionId: string) {
      const { data, error } = await client.from('news').select('news_id,institution_id,academic_period_id,title,slug,summary,content,cover_image_url,published_at,is_published').eq('institution_id', institutionId).order('published_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return ((data ?? []) as NewsRow[]).map(toEntry)
    },
    async save(entry: AcademicContentEntry, institutionId: string) {
      const publishedAt = entry.status === 'published' ? `${entry.date || new Date().toISOString().slice(0, 10)}T12:00:00.000Z` : null
      const payload = {
        news_id: entry.id,
        institution_id: institutionId,
        academic_period_id: entry.periodId || null,
        title: entry.title.trim(),
        slug: slugify(entry.title),
        summary: entry.description.trim(),
        content: serializeNewsContent(entry.description.trim(), entry.sections, entry.periodId),
        cover_image_url: entry.imageUrl ?? null,
        published_at: publishedAt,
        is_published: entry.status === 'published',
      }
      const { data, error } = await client.from('news').upsert(payload, { onConflict: 'news_id' }).select('news_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se guardó la noticia. Verifica el acceso de esta institución.')
      return toEntry({ ...payload, news_id: data.news_id, published_at: publishedAt })
    },
    async remove(id: string, institutionId: string) {
      const { data, error } = await client.from('news').delete().eq('news_id', id).eq('institution_id', institutionId).select('news_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se encontró la noticia o no tienes permiso para eliminarla.')
    },
  }
}

function toEntry(row: NewsRow): AcademicContentEntry {
  const body = parseNewsContent(row.content || row.summary || '')
  return {
    id: row.news_id, institutionId: row.institution_id, kind: 'news', title: row.title,
    description: body.description, sections: body.sections, periodId: row.academic_period_id ?? body.periodId ?? '', status: row.is_published ? 'published' : 'draft',
    date: row.published_at?.slice(0, 10) ?? '', location: '', studentName: '', grade: '',
    distinction: '', startDate: '', endDate: '', isCurrent: false,
    imageUrl: row.cover_image_url ?? undefined, updatedAt: row.published_at ?? '',
  }
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || crypto.randomUUID()
}
