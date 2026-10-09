export type FormFieldProps = {
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  options?: string[]
}

export type StudentFormPageProps = {
  student: import('./student').Student
  section: number
  setSection: (section: number) => void
  onBack: () => void
  onNavigate: (screen: import('./screen').DeceScreen) => void
}

export type FamilyMemberForm = {
  name?: string
  age?: number
  relationship?: string
  maritalStatus?: string
  education?: string
  occupation?: string
  workplace?: string
  phone?: string
}

export type EmergencyContactForm = {
  priority: number
  name?: string
  relationship?: string
  landline?: string
  mobile?: string
}
