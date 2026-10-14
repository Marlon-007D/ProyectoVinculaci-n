export interface SchoolSubject {
  id: string
  name: string
  description: string
  units: { title: string; description: string }[]
}

export const schoolCoursesMock: SchoolSubject[] = [
  {
    id: 'matematica',
    name: 'Matemática',
    description: 'Números, relaciones, geometría y resolución de problemas.',
    units: [
      { title: 'Números enteros, potencias y raíces', description: 'Representa operaciones con números enteros y reconoce las propiedades de potencias y raíces.' },
      { title: 'Ecuaciones e inecuaciones', description: 'Plantea y resuelve expresiones algebraicas para modelar situaciones.' },
      { title: 'Geometría y medida', description: 'Relaciona figuras, magnitudes y unidades para resolver problemas del entorno.' },
      { title: 'Estadística y probabilidad', description: 'Organiza datos, interpreta gráficos y estima la posibilidad de eventos.' },
    ],
  },
  {
    id: 'lengua',
    name: 'Lengua y Literatura',
    description: 'Lectura crítica, comunicación oral y producción de textos.',
    units: [
      { title: 'Lectura y comprensión crítica', description: 'Identifica ideas principales, intención comunicativa e información implícita.' },
      { title: 'Textos de divulgación científica', description: 'Reconoce cómo se explica y comunica información científica a distintos lectores.' },
      { title: 'Crónica, noticia y ensayo', description: 'Compara estructuras y produce textos informativos y de opinión.' },
      { title: 'Literatura y tradición oral', description: 'Explora relatos y expresiones literarias de distintas culturas.' },
    ],
  },
  {
    id: 'ciencias',
    name: 'Ciencias Naturales',
    description: 'Seres vivos, ambiente, materia y exploración científica.',
    units: [
      { title: 'Célula y organización de los seres vivos', description: 'Describe la célula como unidad básica y sus funciones en los organismos.' },
      { title: 'Ecosistemas y flujo de energía', description: 'Explica las relaciones entre organismos, ambiente y cadenas alimenticias.' },
      { title: 'Cuerpo humano y salud', description: 'Relaciona el funcionamiento del cuerpo con hábitos de cuidado y prevención.' },
      { title: 'Materia, Tierra y universo', description: 'Observa propiedades de la materia y fenómenos del planeta y el espacio.' },
    ],
  },
  {
    id: 'estudios-sociales',
    name: 'Estudios Sociales',
    description: 'Historia, territorio, ciudadanía y diversidad del Ecuador.',
    units: [
      { title: 'Historia e identidad del Ecuador', description: 'Reconoce procesos históricos que forman la identidad local y nacional.' },
      { title: 'Geografía y regiones del país', description: 'Interpreta mapas y relaciona las regiones con sus características.' },
      { title: 'Derechos, participación y ciudadanía', description: 'Analiza formas de participación y responsabilidades ciudadanas.' },
      { title: 'Diversidad cultural y convivencia', description: 'Valora la diversidad cultural y propone formas de convivencia respetuosa.' },
    ],
  },
  {
    id: 'ingles',
    name: 'Inglés',
    description: 'Comunicación en inglés para situaciones cotidianas.',
    units: [
      { title: 'Presentaciones e información personal', description: 'Intercambia saludos, datos personales e información básica.' },
      { title: 'Rutinas y actividades diarias', description: 'Describe hábitos y actividades usando vocabulario cotidiano.' },
      { title: 'Lugares, indicaciones y comunidad', description: 'Pregunta por lugares y comprende indicaciones sencillas.' },
      { title: 'Lectura y escritura de textos breves', description: 'Comprende mensajes cortos y redacta textos sencillos en inglés.' },
    ],
  },
  {
    id: 'educacion-fisica',
    name: 'Educación Física',
    description: 'Movimiento, juego, expresión corporal y cuidado personal.',
    units: [
      { title: 'Juegos y prácticas deportivas', description: 'Participa en juegos aplicando reglas y habilidades motrices.' },
      { title: 'Condición física y autocuidado', description: 'Identifica prácticas de actividad física y cuidado personal.' },
      { title: 'Expresión corporal y movimiento', description: 'Comunica ideas y emociones mediante el movimiento.' },
      { title: 'Trabajo en equipo y juego limpio', description: 'Colabora con el grupo y resuelve situaciones de juego con respeto.' },
    ],
  },
  {
    id: 'educacion-cultural',
    name: 'Educación Cultural y Artística',
    description: 'Creación, apreciación artística y expresión cultural.',
    units: [
      { title: 'Elementos del lenguaje visual', description: 'Experimenta con color, forma, línea y composición.' },
      { title: 'Música, ritmo y paisaje sonoro', description: 'Explora ritmos, sonidos y expresiones musicales del entorno.' },
      { title: 'Teatro y expresión corporal', description: 'Crea personajes y escenas usando voz y movimiento.' },
      { title: 'Arte, patrimonio e identidad', description: 'Reconoce expresiones artísticas vinculadas con la memoria y la identidad.' },
    ],
  },
  {
    id: 'emprendimiento',
    name: 'Emprendimiento y Gestión',
    description: 'Ideas, planificación y uso responsable de recursos.',
    units: [
      { title: 'Ideas y necesidades de la comunidad', description: 'Observa necesidades cercanas y propone ideas para atenderlas.' },
      { title: 'Planificación de un proyecto', description: 'Define objetivos, tareas y recursos para una iniciativa sencilla.' },
      { title: 'Presupuesto y recursos', description: 'Estima costos y organiza un presupuesto básico.' },
      { title: 'Trabajo colaborativo y presentación', description: 'Distribuye responsabilidades y comunica resultados.' },
    ],
  },
  {
    id: 'ciudadania',
    name: 'Educación para la Ciudadanía',
    description: 'Convivencia democrática, derechos y responsabilidades.',
    units: [
      { title: 'Derechos y responsabilidades', description: 'Relaciona derechos con responsabilidades en la vida cotidiana.' },
      { title: 'Normas y acuerdos de convivencia', description: 'Construye acuerdos para una convivencia justa y respetuosa.' },
      { title: 'Participación en la comunidad', description: 'Identifica maneras de participar en decisiones colectivas.' },
      { title: 'Cuidado de los espacios comunes', description: 'Propone acciones para cuidar los espacios compartidos.' },
    ],
  },
  {
    id: 'informatica',
    name: 'Informática',
    description: 'Herramientas digitales, ciudadanía y pensamiento computacional.',
    units: [
      { title: 'Partes del computador', description: 'Identifica componentes de entrada, salida y procesamiento.' },
      { title: 'Archivos y herramientas digitales', description: 'Organiza información y utiliza herramientas digitales para tareas escolares.' },
      { title: 'Ciudadanía y seguridad digital', description: 'Reconoce prácticas para cuidar datos y comunicarse con respeto en línea.' },
      { title: 'Pensamiento computacional', description: 'Ordena instrucciones y diseña secuencias para resolver problemas sencillos.' },
    ],
  },
]
