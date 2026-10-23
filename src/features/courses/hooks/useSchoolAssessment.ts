import { useEffect, useState } from 'react'
import { getSchoolQuestionSet } from '../mocks/schoolQuestionMock'
import { getAssessmentSettings, subscribeToSchoolAssessments } from '../services/schoolAssessmentStore'
import { subscribeToSchoolCourses } from '../services/schoolCourseStore'
import { useSchoolCourses } from './useSchoolCourses'

export function useSchoolAssessment(courseId: string, topicTitle: string) {
  const { courses } = useSchoolCourses()
  const course = courses.find(item => item.id === courseId) ?? { id: courseId, name: '', description: '', coverImage: '', units: [] }
  const readAssessment = () => ({
    questions: getSchoolQuestionSet(courseId, topicTitle, course),
    settings: getAssessmentSettings(courseId),
  })
  const [assessment, setAssessment] = useState(readAssessment)

  useEffect(() => {
    setAssessment(readAssessment())
    const unsubscribeAssessments = subscribeToSchoolAssessments(() => setAssessment(readAssessment()))
    const unsubscribeCourses = subscribeToSchoolCourses(() => setAssessment(readAssessment()))
    return () => {
      unsubscribeAssessments()
      unsubscribeCourses()
    }
  }, [courseId, topicTitle, courses])

  return assessment
}
