import { useEffect, useState } from 'react'
import { getSchoolCourses, subscribeToSchoolCourses } from '../services/schoolCourseStore'

export function useSchoolCourses() {
  const [courses, setCourses] = useState(getSchoolCourses)
  useEffect(() => subscribeToSchoolCourses(() => setCourses(getSchoolCourses())), [])
  return courses
}
