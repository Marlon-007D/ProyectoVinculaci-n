import 'dotenv/config'
import postgres from 'postgres'
import { schoolModulesMock } from '../src/features/courses/mocks/schoolModulesMock.ts'
import { schoolCoursesMock } from '../src/features/courses/mocks/schoolCoursesMock.ts'
import { schoolTemarioMock } from '../src/features/courses/mocks/schoolTemarioMock.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the course catalog.')

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
try {
  await sql.begin(async transaction => {
    const institutions = await transaction`select institution_id from public.institutions where is_active = true`
    for (const institution of institutions) {
      const categories = new Map<string, string>()
      for (const [sortOrder, category] of schoolModulesMock.entries()) {
        const [saved] = await transaction`
          insert into public.course_categories (institution_id, slug, name, description, icon, cover_image_url, sort_order, is_published)
          values (${institution.institution_id}, ${category.id}, ${category.name}, ${category.description}, ${category.icon}, nullif(${category.coverImage}, ''), ${sortOrder}, true)
          on conflict (institution_id, slug) do update set
            name = excluded.name, description = excluded.description, icon = excluded.icon,
            cover_image_url = excluded.cover_image_url, sort_order = excluded.sort_order, updated_at = now()
          returning course_category_id, slug
        `
        categories.set(saved.slug, saved.course_category_id)
      }

      for (const [sortOrder, course] of schoolCoursesMock.entries()) {
        const category = schoolModulesMock.find(item => item.courseIds.includes(course.id))
        if (!category) throw new Error(`No category assigned to course ${course.id}`)
        await transaction`
          insert into public.course_modules (institution_id, course_category_id, slug, name, description, cover_image_url, topics, sort_order, is_published)
          values (
            ${institution.institution_id}, ${categories.get(category.id)}, ${course.id}, ${course.name}, ${course.description},
            nullif(${course.coverImage}, ''), ${sql.json(course.units.map((unit, topicIndex) => ({ ...unit, lesson: schoolTemarioMock[course.id]?.[topicIndex] ?? null })))}, ${sortOrder}, true
          )
          on conflict (institution_id, slug) do update set
            course_category_id = excluded.course_category_id, name = excluded.name,
            description = excluded.description, cover_image_url = excluded.cover_image_url,
            topics = excluded.topics, sort_order = excluded.sort_order, updated_at = now()
        `
      }
    }
  })
  console.log('Course catalog seeded for active institutions.')
} finally {
  await sql.end({ timeout: 5 })
}
