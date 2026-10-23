export interface SchoolModule {
  id: string
  name: string
  description: string
  courseIds: string[]
  icon: string
  coverImage: string
}

export interface SchoolTopic {
  title: string
  description: string
  lesson?: import('./schoolTemario.types').TemarioLesson | null
}

export interface SchoolSubject {
  id: string
  name: string
  description: string
  coverImage: string
  units: SchoolTopic[]
}
