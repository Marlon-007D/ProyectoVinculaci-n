import type { StudentFormPageProps } from '../../types/forms'
import { authorizationFormSections } from '../../data/form-sections'
import StudentFormLayout from '../student-form/student-form-layout'
import { createAuthorizationFormSections } from './authorization-form-sections'

export default function AuthorizationFormPage(props: StudentFormPageProps) {
  return (
    <StudentFormLayout
      {...props}
      kind="authorization"
      heading="Ficha de autorización para atención y emergencias"
      labels={authorizationFormSections}
      contents={createAuthorizationFormSections(props.student)}
    />
  )
}
