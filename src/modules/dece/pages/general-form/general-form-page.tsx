import type { StudentFormPageProps } from '../../types/forms'
import { generalFormSections } from '../../data/form-sections'
import StudentFormLayout from '../student-form/student-form-layout'
import { createGeneralFormSections } from './general-form-sections'

export default function GeneralFormPage(props: StudentFormPageProps) {
  return (
    <StudentFormLayout
      {...props}
      kind="general"
      heading="Registro general acumulativo estudiantil"
      labels={generalFormSections}
      contents={createGeneralFormSections(props.student)}
    />
  )
}
