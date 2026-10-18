import { useEffect, useState } from 'react'
import { getSchoolQuestionSet } from '../mocks/schoolQuestionMock'
import { getAssessmentSettings, subscribeToSchoolAssessments } from '../services/schoolAssessmentStore'
import { subscribeToSchoolCourses } from '../services/schoolCourseStore'

export function useSchoolAssessment(courseId: string, topicTitle: string) {
  const readAssessment = () => ({
    questions: getSchoolQuestionSet(courseId, topicTitle),
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
  }, [courseId, topicTitle])

  return assessment
}
