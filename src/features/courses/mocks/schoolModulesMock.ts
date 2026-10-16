export interface SchoolModule {
  id: string
  name: string
  description: string
  courseIds: string[]
}

export const schoolModulesMock: SchoolModule[] = [
  { id: 'matematica', name: 'Matemática', description: 'Razonamiento numérico y resolución de problemas.', courseIds: ['matematica'] },
  { id: 'tecnologia', name: 'Tecnología', description: 'Herramientas digitales y pensamiento computacional.', courseIds: ['informatica'] },
  { id: 'lengua-comunicacion', name: 'Lengua y comunicación', description: 'Lectura, escritura y comunicación en otros idiomas.', courseIds: ['lengua', 'ingles'] },
  { id: 'ciencias-sociedad', name: 'Ciencias y sociedad', description: 'Naturaleza, historia y convivencia ciudadana.', courseIds: ['ciencias', 'estudios-sociales', 'ciudadania'] },
  { id: 'arte-desarrollo', name: 'Arte y desarrollo personal', description: 'Expresión artística, movimiento y proyectos.', courseIds: ['educacion-cultural', 'educacion-fisica', 'emprendimiento'] },
]
