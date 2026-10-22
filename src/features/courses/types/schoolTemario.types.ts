export interface TemarioPhoto {
  src: string
  alt: string
  caption: string
}

export interface TemarioConcept {
  title: string
  detail: string
}

export interface TemarioSource {
  title: string
  url: string
}

export interface TemarioLesson {
  introduction: string
  concepts: TemarioConcept[]
  exampleTitle: string
  example: string
  activity: string
  photos: TemarioPhoto[]
  sources: TemarioSource[]
}
