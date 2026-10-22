import { schoolCoursesMock, type SchoolSubject } from '../mocks/schoolCoursesMock'
import { schoolTemarioMock } from '../mocks/schoolTemarioMock'
import type { TemarioLesson } from '../types/schoolTemario.types'
import { getCourseCategories, saveCourseCategories } from './courseCategoriesStore'
import { deleteCourseAssessments } from './schoolAssessmentStore'

const storageKey = 'school-course-content-v1'
const changeEvent = 'school-course-content-change'

interface StoredCourseContent {
  courseOverrides: Record<string, SchoolSubject>
  newCourses: SchoolSubject[]
  deletedCourseIds: string[]
  lessons: Record<string, Record<string, TemarioLesson>>
}

function emptyStore(): StoredCourseContent {
  return { courseOverrides: {}, newCourses: [], deletedCourseIds: [], lessons: {} }
}

function readStore(): StoredCourseContent {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return emptyStore()
    const value = JSON.parse(raw) as Partial<StoredCourseContent>
    return {
      courseOverrides: value.courseOverrides ?? {},
      newCourses: value.newCourses ?? [],
      deletedCourseIds: value.deletedCourseIds ?? [],
      lessons: value.lessons ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(value: StoredCourseContent) {
  window.localStorage.setItem(storageKey, JSON.stringify(value))
  window.dispatchEvent(new Event(changeEvent))
}

export function getSchoolCourses(): SchoolSubject[] {
  const store = readStore()
  return [
    ...schoolCoursesMock.map(course => store.courseOverrides[course.id] ?? course),
    ...store.newCourses,
  ].filter(course => !store.deletedCourseIds.includes(course.id))
}

export function createBlankLesson(): TemarioLesson {
  return {
    introduction: '',
    concepts: Array.from({ length: 6 }, (_, index) => ({ title: `Concepto ${index + 1}`, detail: '' })),
    exampleTitle: '',
    example: '',
    activity: '',
    photos: [],
    sources: [],
  }
}

export function getSchoolCourseLesson(courseId: string, topicIndex: number): TemarioLesson {
  const saved = readStore().lessons[courseId]?.[String(topicIndex)]
  return saved ?? schoolTemarioMock[courseId]?.[topicIndex] ?? createBlankLesson()
}

export function saveSchoolCourse(course: SchoolSubject): void {
  const store = readStore()
  if (schoolCoursesMock.some(item => item.id === course.id)) store.courseOverrides[course.id] = course
  else store.newCourses = [...store.newCourses.filter(item => item.id !== course.id), course]
  store.deletedCourseIds = store.deletedCourseIds.filter(id => id !== course.id)
  writeStore(store)
}

export function saveSchoolCourseLesson(courseId: string, topicIndex: number, lesson: TemarioLesson): void {
  const store = readStore()
  store.lessons[courseId] = { ...store.lessons[courseId], [String(topicIndex)]: lesson }
  writeStore(store)
}

export function deleteSchoolCourse(courseId: string): void {
  const store = readStore()
  store.newCourses = store.newCourses.filter(course => course.id !== courseId)
  delete store.courseOverrides[courseId]
  delete store.lessons[courseId]
  if (schoolCoursesMock.some(course => course.id === courseId) && !store.deletedCourseIds.includes(courseId)) {
    store.deletedCourseIds.push(courseId)
  }
  writeStore(store)
  deleteCourseAssessments(courseId)
  saveCourseCategories(getCourseCategories().map(category => ({
    ...category,
    courseIds: category.courseIds.filter(id => id !== courseId),
  })))
}

export function subscribeToSchoolCourses(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(changeEvent, onChange)
    window.removeEventListener('storage', onChange)
  }
}
