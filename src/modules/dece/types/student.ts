export type Student = {
  /** Identificador visible en el directorio (en la demo es la cédula). */
  id: string
  /** UUID de public.students; lo entrega el adaptador de datos real. */
  recordId?: string
  name: string
  firstName?: string
  lastName?: string
  grade: string
  initials: string
  color: string
}
