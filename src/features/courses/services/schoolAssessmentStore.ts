import type { AssessmentQuestionSet } from '../mocks/schoolQuestionMock'

const storageKey = 'school-course-assessments-v1'
const changeEvent = 'school-course-assessments-change'

export interface AssessmentSettings {
  durationMinutes: number
  totalPoints: number
}

const defaultSettings: AssessmentSettings = { durationMinutes: 10, totalPoints: 20 }

interface StoredAssessments {
  settings: Record<string, AssessmentSettings>
  questions: Record<string, Record<string, AssessmentQuestionSet>>
}

function readStore(): StoredAssessments {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { settings: {}, questions: {} }
    const parsed = JSON.parse(raw) as Partial<StoredAssessments>
    return { settings: parsed.settings ?? {}, questions: parsed.questions ?? {} }
  } catch {
    return { settings: {}, questions: {} }
  }
}

function writeStore(store: StoredAssessments) {
  window.localStorage.setItem(storageKey, JSON.stringify(store))
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeToSchoolAssessments(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(changeEvent, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function getAssessmentSettings(courseId: string): AssessmentSettings {
  return { ...defaultSettings, ...readStore().settings[courseId] }
}

export function saveAssessmentSettings(courseId: string, settings: AssessmentSettings): void {
  const store = readStore()
  store.settings[courseId] = settings
  writeStore(store)
}

export function getAssessmentOverride(courseId: string, topicTitle: string): AssessmentQuestionSet | null {
  return readStore().questions[courseId]?.[topicTitle] ?? null
}

export function saveAssessmentOverride(courseId: string, topicTitle: string, questions: AssessmentQuestionSet): void {
  const store = readStore()
  store.questions[courseId] = { ...store.questions[courseId], [topicTitle]: questions }
  writeStore(store)
}

export function deleteCourseAssessments(courseId: string): void {
  const store = readStore()
  delete store.settings[courseId]
  delete store.questions[courseId]
  writeStore(store)
}
