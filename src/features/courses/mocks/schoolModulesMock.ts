import type { SchoolModule } from '../types/courseCatalog.types'

export type { SchoolModule } from '../types/courseCatalog.types'

export const schoolModulesMock: SchoolModule[] = [
  { id: 'matematica', name: 'Matemática', description: 'Razonamiento numérico y resolución de problemas.', courseIds: ['matematica'], icon: 'sigma', coverImage: '' },
  { id: 'tecnologia', name: 'Tecnología', description: 'Herramientas digitales y pensamiento computacional.', courseIds: ['informatica'], icon: 'laptop', coverImage: '' },
  { id: 'lengua-comunicacion', name: 'Lengua y comunicación', description: 'Lectura, escritura y comunicación en otros idiomas.', courseIds: ['lengua', 'ingles'], icon: 'languages', coverImage: '' },
  { id: 'ciencias-sociedad', name: 'Ciencias y sociedad', description: 'Naturaleza, historia y convivencia ciudadana.', courseIds: ['ciencias', 'estudios-sociales', 'ciudadania'], icon: 'flask', coverImage: '' },
  { id: 'arte-desarrollo', name: 'Arte y desarrollo personal', description: 'Expresión artística, movimiento y proyectos.', courseIds: ['educacion-cultural', 'educacion-fisica', 'emprendimiento'], icon: 'palette', coverImage: '' },
]
