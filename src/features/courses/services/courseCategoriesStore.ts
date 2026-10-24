import { supabase } from '../../../core/supabaseClient'
import type { SchoolModule } from '../types/courseCatalog.types'

const changeEvent = 'school-course-categories-change'

export async function getCourseCategories(institutionId: string): Promise<SchoolModule[]> {
  const { data, error } = await supabase
    .from('course_categories')
    .select('slug, name, description, icon, cover_image_url, course_category_id')
    .eq('institution_id', institutionId)
    .order('sort_order')
  if (error) throw error

  const { data: modules, error: moduleError } = await supabase
    .from('course_modules')
    .select('slug, course_category_id')
    .eq('institution_id', institutionId)
    .order('sort_order')
  if (moduleError) throw moduleError

  return (data ?? []).map(category => ({
    id: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    coverImage: category.cover_image_url ?? '',
    courseIds: (modules ?? []).filter(course => course.course_category_id === category.course_category_id).map(course => course.slug),
  }))
}

export async function saveCourseCategories(institutionId: string, categories: SchoolModule[]): Promise<void> {
  const { data: saved, error } = await supabase
    .from('course_categories')
    .upsert(categories.map((category, sortOrder) => ({
      institution_id: institutionId,
      slug: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      cover_image_url: category.coverImage || null,
      sort_order: sortOrder,
      is_published: true,
    })), { onConflict: 'institution_id,slug' })
    .select('course_category_id, slug')
  if (error) throw error

  for (const category of categories) {
    const categoryId = saved?.find(item => item.slug === category.id)?.course_category_id
    if (!categoryId) continue
    for (const courseId of category.courseIds) {
      const { error: updateError } = await supabase.from('course_modules')
        .update({ course_category_id: categoryId, updated_at: new Date().toISOString() })
        .eq('institution_id', institutionId).eq('slug', courseId)
      if (updateError) throw updateError
    }
  }

  const keepSlugs = categories.map(category => category.id)
  const { data: existing, error: readError } = await supabase.from('course_categories')
    .select('course_category_id, slug').eq('institution_id', institutionId)
  if (readError) throw readError
  const removedIds = (existing ?? []).filter(category => !keepSlugs.includes(category.slug)).map(category => category.course_category_id)
  if (removedIds.length) {
    const { error: deleteError } = await supabase.from('course_categories')
      .delete().eq('institution_id', institutionId).in('course_category_id', removedIds)
    if (deleteError) throw deleteError
  }
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeToCourseCategories(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  return () => window.removeEventListener(changeEvent, onChange)
}
