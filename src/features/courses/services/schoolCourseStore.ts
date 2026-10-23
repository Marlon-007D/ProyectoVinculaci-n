import { supabase } from '../../../core/supabaseClient'
import type { SchoolSubject } from '../types/courseCatalog.types'
import type { TemarioLesson } from '../types/schoolTemario.types'
import { deleteCourseAssessments } from './schoolAssessmentStore'

const changeEvent = 'school-course-content-change'

export async function getSchoolCourses(institutionId: string): Promise<SchoolSubject[]> {
  const { data, error } = await supabase.from('course_modules')
    .select('slug, name, description, cover_image_url, topics')
    .eq('institution_id', institutionId).order('sort_order')
  if (error) throw error
  return (data ?? []).map(course => ({
    id: course.slug,
    name: course.name,
    description: course.description,
    coverImage: course.cover_image_url ?? '',
    units: Array.isArray(course.topics) ? course.topics : [],
  }))
}

export function createBlankLesson(): TemarioLesson {
  return {
    introduction: '', concepts: Array.from({ length: 6 }, (_, index) => ({ title: `Concepto ${index + 1}`, detail: '' })),
    exampleTitle: '', example: '', activity: '', photos: [], sources: [],
  }
}

// Detailed lesson material remains managed by the course content editor.
export async function saveSchoolCourse(institutionId: string, course: SchoolSubject, categoryId: string, lessons: Record<number, TemarioLesson>): Promise<void> {
  const { data: category, error: categoryError } = await supabase.from('course_categories')
    .select('course_category_id').eq('institution_id', institutionId).eq('slug', categoryId).single()
  if (categoryError) throw categoryError
  const { error } = await supabase.from('course_modules').upsert({
    institution_id: institutionId,
    course_category_id: category.course_category_id,
    slug: course.id,
    name: course.name,
    description: course.description,
    cover_image_url: course.coverImage || null,
    topics: course.units.map((topic, index) => ({ ...topic, lesson: lessons[index] ?? topic.lesson ?? null })),
    is_published: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'institution_id,slug' })
  if (error) throw error
  window.dispatchEvent(new Event(changeEvent))
}

export async function deleteSchoolCourse(institutionId: string, courseId: string): Promise<void> {
  const { error } = await supabase.from('course_modules').delete()
    .eq('institution_id', institutionId).eq('slug', courseId)
  if (error) throw error
  deleteCourseAssessments(courseId)
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeToSchoolCourses(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  return () => window.removeEventListener(changeEvent, onChange)
}
