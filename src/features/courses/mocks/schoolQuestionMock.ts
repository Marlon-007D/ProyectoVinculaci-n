import { getAssessmentOverride } from '../services/schoolAssessmentStore'
import type { SchoolSubject } from '../types/courseCatalog.types'

export type MultipleChoiceQuestion = { prompt: string; options: string[]; answer: number }
export type MultipleSelectQuestion = { prompt: string; options: string[]; answers: number[]; optionImages: { imageUrl: string; imageAlt: string }[] }
export type WordSearchQuestion = { prompt: string; words: string[]; grid: string[] }

export interface CourseQuestionSet {
  multipleChoice: MultipleChoiceQuestion
  multipleSelect: MultipleSelectQuestion
  matching: { prompt: string; pairs: { imageUrl: string; imageAlt: string; match: string }[]; options: string[] }
  wordSearch: WordSearchQuestion
}

export interface AssessmentQuestionSet extends CourseQuestionSet {
  multipleChoiceVersions: MultipleChoiceQuestion[]
  multipleSelectVersions: MultipleSelectQuestion[]
  wordSearchVersions: WordSearchQuestion[]
}

export const schoolQuestionMock: Record<string, CourseQuestionSet> = {
  matematica: {
    multipleChoice: { prompt: '¿Cuál es el resultado de 3² + 4?', options: ['10', '13', '14', '16'], answer: 1 },
    multipleSelect: { prompt: 'Selecciona todos los números pares.', options: ['2', '3', '4', '5'], answers: [0, 2], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=160&q=75', imageAlt: 'Expresiones matemáticas' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Ejercicios en un cuaderno' },
      { imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=160&q=75', imageAlt: 'Aula de clases' },
      { imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=160&q=75', imageAlt: 'Libro abierto' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con el concepto matemático correspondiente.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=360&q=80', imageAlt: 'Expresiones matemáticas escritas en una pizarra', match: 'Expresión matemática' }, { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Persona resolviendo ejercicios en un cuaderno', match: 'Resolución de ejercicios' }], options: ['Resolución de ejercicios', 'Expresión matemática'] },
    wordSearch: { prompt: 'Encuentra las palabras relacionadas con el tema.', words: ['SUMA', 'RESTA', 'AREA', 'BASE', 'EJE', 'CERO', 'PAR', 'OVALO', 'RECTA', 'ANGULO'], grid: [] },
  },
  lengua: {
    multipleChoice: { prompt: '¿Qué parte de una noticia presenta brevemente el hecho principal?', options: ['Titular', 'Desenlace', 'Diálogo', 'Personaje'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona elementos que pueden aparecer en una narración.', options: ['Personajes', 'Escenario', 'Suma', 'Narrador'], answers: [0, 1, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=160&q=75', imageAlt: 'Libro abierto' },
      { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=75', imageAlt: 'Paisaje para ambientar una narración' },
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=160&q=75', imageAlt: 'Ejercicio de matemáticas' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Persona escribiendo' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con la práctica de lectura o escritura.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Mano escribiendo un texto', match: 'Producción escrita' }, { imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=360&q=80', imageAlt: 'Libros abiertos para la lectura', match: 'Lectura literaria' }], options: ['Lectura literaria', 'Producción escrita'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con la lectura y la escritura.', words: ['TEXTO', 'LIBRO', 'PROSA', 'RIMA', 'VERSO', 'AUTOR', 'LETRA', 'TITULO', 'CUENTO', 'ORAL'], grid: [] },
  },
  ciencias: {
    multipleChoice: { prompt: '¿Qué estructura es la unidad básica de los seres vivos?', options: ['La célula', 'El mineral', 'El clima', 'La montaña'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona los seres vivos.', options: ['Una planta', 'El agua', 'Un animal', 'Una roca'], answers: [0, 2], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=160&q=75', imageAlt: 'Planta verde' },
      { imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=160&q=75', imageAlt: 'Material de laboratorio' },
      { imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=160&q=75', imageAlt: 'Bosque natural' },
      { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=75', imageAlt: 'Paisaje rocoso' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con el área de estudio correspondiente.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=360&q=80', imageAlt: 'Material de laboratorio para una investigación científica', match: 'Investigación científica' }, { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80', imageAlt: 'Paisaje natural con vegetación y montañas', match: 'Ecosistema' }], options: ['Ecosistema', 'Investigación científica'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con los ecosistemas.', words: ['CELULA', 'AGUA', 'AIRE', 'ROCA', 'SUELO', 'FLORA', 'FAUNA', 'CLIMA', 'LUZ', 'VIDA'], grid: [] },
  },
  'estudios-sociales': {
    multipleChoice: { prompt: '¿Cuál es una de las regiones naturales del Ecuador?', options: ['Sierra', 'Sahara', 'Alpes', 'Himalaya'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona regiones naturales del Ecuador.', options: ['Costa', 'Sahara', 'Sierra', 'Amazonía'], answers: [0, 2, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=75', imageAlt: 'Paisaje de la Costa' },
      { imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=160&q=75', imageAlt: 'Imagen de referencia' },
      { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=75&sat=-40', imageAlt: 'Paisaje de la Sierra' },
      { imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=160&q=75', imageAlt: 'Vegetación de la Amazonía' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con el concepto social o geográfico.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80', imageAlt: 'Paisaje de una región geográfica', match: 'Territorio' }, { imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=360&q=80', imageAlt: 'Grupo de personas reunidas en comunidad', match: 'Comunidad' }], options: ['Comunidad', 'Territorio'] },
    wordSearch: { prompt: 'Encuentra palabras de la geografía y cultura ecuatoriana.', words: ['COSTA', 'SIERRA', 'MAPA', 'RIO', 'ISLA', 'PUEBLO', 'VALLE', 'COLINA', 'QUITO', 'ANDES'], grid: [] },
  },
  ingles: {
    multipleChoice: { prompt: '¿Qué significa “book” en español?', options: ['Libro', 'Mesa', 'Puerta', 'Ventana'], answer: 0 },
    multipleSelect: { prompt: 'Select all the school objects.', options: ['Book', 'Run', 'Pencil', 'Desk'], answers: [0, 2, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=160&q=75', imageAlt: 'Open book' },
      { imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=160&q=75', imageAlt: 'Running activity' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Writing in a notebook' },
      { imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=160&q=75', imageAlt: 'Classroom desk' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con su palabra en inglés.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=360&q=80', imageAlt: 'Libro abierto', match: 'Book' }, { imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=360&q=80', imageAlt: 'Aula escolar preparada para una clase', match: 'Classroom' }], options: ['Classroom', 'Book'] },
    wordSearch: { prompt: 'Find words related to school.', words: ['BOOK', 'PEN', 'DESK', 'BAG', 'PAGE', 'CLASS', 'WORD', 'READ', 'WRITE', 'LESSON'], grid: [] },
  },
  'educacion-fisica': {
    multipleChoice: { prompt: '¿Qué conviene hacer antes de iniciar actividad física?', options: ['Calentar el cuerpo', 'Dejar de hidratarse', 'Evitar moverse', 'Comenzar con el máximo esfuerzo'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona hábitos que ayudan a cuidar la salud.', options: ['Beber agua', 'Dormir bien', 'No desayunar', 'Mover el cuerpo'], answers: [0, 1, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=160&q=75', imageAlt: 'Actividad física' },
      { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=75', imageAlt: 'Descanso al aire libre' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Cuaderno de hábitos diarios' },
      { imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=160&q=75', imageAlt: 'Actividad en grupo' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con la práctica de bienestar.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=360&q=80', imageAlt: 'Persona realizando ejercicio físico', match: 'Actividad física' }, { imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80', imageAlt: 'Persona caminando por un espacio natural', match: 'Actividad al aire libre' }], options: ['Actividad al aire libre', 'Actividad física'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con la actividad física.', words: ['SALUD', 'JUEGO', 'AGUA', 'FUERZA', 'SALTO', 'META', 'PASE', 'EQUIPO', 'CUERPO', 'RITMO'], grid: [] },
  },
  'educacion-cultural': {
    multipleChoice: { prompt: '¿Qué elemento se relaciona con el lenguaje visual?', options: ['Color', 'Presupuesto', 'Ecuación', 'Velocidad'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona elementos del lenguaje visual.', options: ['Color', 'Línea', 'Fracción', 'Forma'], answers: [0, 1, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=160&q=75', imageAlt: 'Pintura y colores' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Trazos en un cuaderno' },
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=160&q=75', imageAlt: 'Fórmulas matemáticas' },
      { imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=160&q=75&sat=-50', imageAlt: 'Formas en una obra artística' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con su forma de expresión artística.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=360&q=80', imageAlt: 'Materiales y obra de pintura artística', match: 'Artes visuales' }, { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Persona creando una composición escrita', match: 'Expresión escrita' }], options: ['Expresión escrita', 'Artes visuales'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con el arte.', words: ['ARTE', 'COLOR', 'LINEA', 'FORMA', 'DANZA', 'RITMO', 'NOTA', 'CANTO', 'OBRA', 'TRAZO'], grid: [] },
  },
  emprendimiento: {
    multipleChoice: { prompt: '¿Qué ayuda a planificar los gastos de un proyecto?', options: ['Presupuesto', 'Adivinanza', 'Croquis', 'Canción'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona datos que ayudan a organizar un emprendimiento.', options: ['Ingresos', 'Costos', 'Presupuesto', 'Chismes'], answers: [0, 1, 2], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=160&q=75', imageAlt: 'Equipo de trabajo' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Registro de gastos' },
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=160&q=75', imageAlt: 'Cálculos para un presupuesto' },
      { imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=160&q=75', imageAlt: 'Conversación en grupo' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con una etapa de un emprendimiento.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=360&q=80', imageAlt: 'Equipo colaborando en la planificación de un proyecto', match: 'Planificación' }, { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Persona anotando ideas para organizar un proyecto', match: 'Registro de ideas' }], options: ['Registro de ideas', 'Planificación'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con un emprendimiento.', words: ['IDEA', 'PLAN', 'META', 'COSTO', 'VENTA', 'CAJA', 'SOCIO', 'PRECIO', 'AHORRO', 'MARCA'], grid: [] },
  },
  ciudadania: {
    multipleChoice: { prompt: '¿Cuál es una forma de participar en la comunidad?', options: ['Dialogar y proponer', 'Ignorar los acuerdos', 'Excluir al grupo', 'Evitar colaborar'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona acciones que favorecen la convivencia.', options: ['Escuchar a los demás', 'Respetar acuerdos', 'Excluir a alguien', 'Dialogar'], answers: [0, 1, 3], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=160&q=75', imageAlt: 'Personas conversando' },
      { imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=160&q=75', imageAlt: 'Grupo colaborando' },
      { imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=160&q=75', imageAlt: 'Aula escolar' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=160&q=75', imageAlt: 'Anotaciones de una conversación' },
    ] },
    matching: { prompt: 'Relaciona cada imagen con una práctica ciudadana.', pairs: [{ imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=360&q=80', imageAlt: 'Personas colaborando como comunidad', match: 'Participación comunitaria' }, { imageUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=360&q=80', imageAlt: 'Grupo dialogando y tomando decisiones', match: 'Diálogo y acuerdos' }], options: ['Diálogo y acuerdos', 'Participación comunitaria'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con la convivencia.', words: ['VOTO', 'LEY', 'PAZ', 'AYUDA', 'RESPETO', 'DERECHOS', 'BARRIO', 'NORMA', 'DEBER', 'VOZ'], grid: [] },
  },
  informatica: {
    multipleChoice: { prompt: '¿Cuál de estos dispositivos se utiliza principalmente para ingresar texto?', options: ['Teclado', 'Monitor', 'Parlante', 'Impresora'], answer: 0 },
    multipleSelect: { prompt: 'Selecciona dispositivos de entrada.', options: ['Teclado', 'Monitor', 'Ratón', 'Impresora'], answers: [0, 2], optionImages: [
      { imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=160&q=75', imageAlt: 'Teclado de computador' },
      { imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=160&q=75', imageAlt: 'Monitor de computador' },
      { imageUrl: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=160&q=75', imageAlt: 'Ratón de computador' },
      { imageUrl: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=160&q=75', imageAlt: 'Computador de escritorio' },
    ] },
    matching: { prompt: 'Relaciona cada foto con el componente del computador.', pairs: [
      { imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=360&q=80', imageAlt: 'Monitor de computador sobre un escritorio', match: 'Monitor' },
      { imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=360&q=80', imageAlt: 'Teclado de computador', match: 'Teclado' },
      { imageUrl: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=360&q=80', imageAlt: 'Ratón de computador', match: 'Ratón' },
      { imageUrl: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=360&q=80', imageAlt: 'Computador de escritorio', match: 'Computador' },
    ], options: ['Ratón', 'Computador', 'Monitor', 'Teclado'] },
    wordSearch: { prompt: 'Encuentra palabras relacionadas con los dispositivos y la informática.', words: ['TECLA', 'MOUSE', 'RATON', 'CHIP', 'DATOS', 'CODIGO', 'APP', 'WEB', 'PC', 'USB'], grid: [] },
  },
}

type TopicAssessmentOverride = {
  choices: MultipleChoiceQuestion[]
  selects: Array<Omit<MultipleSelectQuestion, 'optionImages'>>
  matching: CourseQuestionSet['matching']
}

const topicAssessmentOverrides: Record<string, TopicAssessmentOverride> = {
  'matematica:0': {
    choices: [
      { prompt: 'Calcula: −3² + 2³.', options: ['−1', '17', '1', '−17'], answer: 0 },
      { prompt: '¿Qué igualdad aplica correctamente las propiedades de las potencias?', options: ['2⁴ · 2³ = 2⁷', '2⁴ · 2³ = 4⁷', '2⁴ + 2³ = 2⁷', '2⁴ ÷ 2³ = 2⁷'], answer: 0 },
      { prompt: 'Una temperatura baja de 4 °C a −7 °C. ¿Cuál fue la variación?', options: ['−11 °C', '−3 °C', '11 °C', '3 °C'], answer: 0 },
    ],
    selects: [
      { prompt: 'Selecciona todas las expresiones cuyo valor es 16.', options: ['2⁴', '√256', '4²', '2³'], answers: [0, 1, 2] },
      { prompt: 'Marca las afirmaciones verdaderas sobre números enteros.', options: ['−8 < −3', 'El opuesto de −12 es 12', '0 es positivo', '−5 + 5 = 0'], answers: [1, 3] },
      { prompt: 'Selecciona los resultados correctos.', options: ['(−4)² = 16', '√49 = 7', '2⁵ = 10', '−3² = 9'], answers: [0, 1] },
      { prompt: '¿Qué operaciones dan como resultado un número negativo?', options: ['−6 + 2', '3 − 9', '(−4)(−2)', '√36'], answers: [0, 1] },
    ],
    matching: { prompt: 'Relaciona cada representación con el resultado correcto.', pairs: [
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=360&q=80', imageAlt: 'Expresiones matemáticas en una pizarra', match: '3³ = 27' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Procedimiento matemático escrito', match: '√81 = 9' },
    ], options: ['√81 = 9', '3³ = 27'] },
  },
  'matematica:1': {
    choices: [
      { prompt: 'Resuelve la ecuación: 3x − 7 = 11.', options: ['x = 6', 'x = 4', 'x = 18', 'x = −6'], answer: 0 },
      { prompt: '¿Qué valor satisface 5(x − 2) ≤ 15?', options: ['x = 5', 'x = 6', 'x = 8', 'x = 10'], answer: 0 },
      { prompt: 'Al sumar 4 a ambos miembros de x − 4 = 9, se obtiene:', options: ['x = 13', 'x = 5', '4x = 13', 'x − 8 = 9'], answer: 0 },
    ],
    selects: [
      { prompt: 'Selecciona valores que satisfacen x + 3 > 8.', options: ['x = 6', 'x = 5', 'x = 8', 'x = 4'], answers: [0, 2] },
      { prompt: 'Marca pasos válidos para resolver 2x + 5 = 17.', options: ['Restar 5 a ambos miembros', 'Dividir ambos miembros entre 2', 'Multiplicar 17 por 5', 'Cambiar 2x por x²'], answers: [0, 1] },
      { prompt: '¿Qué ecuaciones tienen solución x = 4?', options: ['x + 6 = 10', '3x = 12', 'x − 4 = 4', '2x + 1 = 9'], answers: [0, 1, 3] },
      { prompt: 'Selecciona expresiones equivalentes a 4x − 8.', options: ['4(x − 2)', '2(2x − 4)', '4x + 8', '8(x − 1)'], answers: [0, 1] },
    ],
    matching: { prompt: 'Relaciona cada ecuación con su solución.', pairs: [
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=360&q=80', imageAlt: 'Ecuaciones en una pizarra', match: '2x + 3 = 11 → x = 4' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Procedimiento de resolución escrito', match: 'x − 5 = 2 → x = 7' },
    ], options: ['x − 5 = 2 → x = 7', '2x + 3 = 11 → x = 4'] },
  },
  'matematica:2': {
    choices: [
      { prompt: 'Un triángulo tiene base 12 cm y altura 7 cm. ¿Cuál es su área?', options: ['42 cm²', '84 cm²', '19 cm²', '38 cm²'], answer: 0 },
      { prompt: '¿A cuántos centímetros equivalen 2,5 metros?', options: ['250 cm', '25 cm', '2 500 cm', '0,25 cm'], answer: 0 },
      { prompt: 'Un rectángulo mide 8 m por 5 m. ¿Cuál es su perímetro?', options: ['26 m', '40 m', '13 m', '20 m'], answer: 0 },
    ],
    selects: [
      { prompt: 'Selecciona las magnitudes que se miden en unidades cuadradas.', options: ['Área de un patio', 'Superficie de una pared', 'Longitud de una cuerda', 'Masa de una mochila'], answers: [0, 1] },
      { prompt: 'Marca equivalencias correctas.', options: ['1 km = 1 000 m', '3 m = 300 cm', '1 m² = 100 cm²', '500 cm = 5 m'], answers: [0, 1, 3] },
      { prompt: 'Selecciona figuras que tienen todos sus lados iguales.', options: ['Cuadrado', 'Rombo', 'Rectángulo', 'Triángulo escaleno'], answers: [0, 1] },
      { prompt: 'Para hallar el área de un triángulo se necesita conocer:', options: ['Base', 'Altura perpendicular', 'Perímetro', 'Radio'], answers: [0, 1] },
    ],
    matching: { prompt: 'Relaciona cada cálculo con la magnitud que obtiene.', pairs: [
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=360&q=80', imageAlt: 'Diagramas geométricos', match: 'b · h ÷ 2 → área' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Medidas anotadas', match: '2(largo + ancho) → perímetro' },
    ], options: ['2(largo + ancho) → perímetro', 'b · h ÷ 2 → área'] },
  },
  'matematica:3': {
    choices: [
      { prompt: 'En los datos 4, 6, 6, 8, 10, ¿cuál es la mediana?', options: ['6', '8', '6,8', '4'], answer: 0 },
      { prompt: 'Una bolsa tiene 3 fichas rojas y 1 azul. ¿Cuál es la probabilidad de extraer una roja?', options: ['3/4', '1/4', '1/3', '4/3'], answer: 0 },
      { prompt: 'En una encuesta, 18 de 30 estudiantes prefieren fútbol. ¿Qué porcentaje representa?', options: ['60 %', '18 %', '40 %', '80 %'], answer: 0 },
    ],
    selects: [
      { prompt: 'Selecciona situaciones donde conviene usar una gráfica de barras.', options: ['Comparar ventas por mes', 'Mostrar cantidad de estudiantes por curso', 'Medir la temperatura cada hora', 'Comparar preferencias de colores'], answers: [0, 1, 3] },
      { prompt: 'Marca eventos imposibles al lanzar un dado común.', options: ['Obtener 7', 'Obtener un número par', 'Obtener 0', 'Obtener un número menor que 7'], answers: [0, 2] },
      { prompt: 'Selecciona medidas de tendencia central.', options: ['Media', 'Mediana', 'Moda', 'Rango'], answers: [0, 1, 2] },
      { prompt: 'En el conjunto 2, 2, 5, 7, 7, ¿qué afirmaciones son correctas?', options: ['La moda es 2 y 7', 'La mediana es 5', 'La media es 7', 'Hay cinco datos'], answers: [0, 1, 3] },
    ],
    matching: { prompt: 'Relaciona cada situación con el concepto estadístico adecuado.', pairs: [
      { imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=360&q=80', imageAlt: 'Datos y gráficos', match: 'Valor central de datos ordenados → mediana' },
      { imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=360&q=80', imageAlt: 'Registro de resultados', match: 'Resultado más frecuente → moda' },
    ], options: ['Resultado más frecuente → moda', 'Valor central de datos ordenados → mediana'] },
  },
}

const fallbackSet = schoolQuestionMock.ciencias
function createChallengeGrid(words: string[], seedText: string): string[] {
  const size = 8
  const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'
  let seed = [...seedText].reduce((value, char) => value + char.charCodeAt(0), 17)
  const random = (limit: number) => {
    seed = (seed * 9301 + 49297) % 233280
    return Math.floor((seed / 233280) * limit)
  }
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => {
    return alphabet[random(alphabet.length)]
  }))
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  const occupied = new Map<number, string>()
  words.forEach((word, wordIndex) => {
    const letters = [...word.toUpperCase()]
    const diagonalDirections = directions.filter(([rowStep, colStep]) => rowStep !== 0 && colStep !== 0)
    const allowedDirections = wordIndex < 2 ? diagonalDirections : directions
    for (let attempt = 0; attempt < 5000; attempt++) {
      const [rowStep, colStep] = allowedDirections[random(allowedDirections.length)]
      const row = random(size)
      const col = random(size)
      const endRow = row + rowStep * (letters.length - 1)
      const endCol = col + colStep * (letters.length - 1)
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue
      const positions = letters.map((_, index) => [row + rowStep * index, col + colStep * index] as const)
      if (positions.some(([r, c], index) => {
        const existing = occupied.get(r * size + c)
        return existing !== undefined && existing !== letters[index]
      })) continue
      positions.forEach(([r, c], index) => {
        grid[r][c] = letters[index]
        occupied.set(r * size + c, letters[index])
      })
      break
    }
  })
  return grid.map(row => row.join(' '))
}

function topicWords(value: string): string[] {
  const ignored = new Set(['para', 'sobre', 'desde', 'hasta', 'este', 'esta', 'como', 'cuando', 'entre', 'cada', 'los', 'las', 'del', 'con', 'una', 'uno', 'que', 'por', 'sus', 'y'])
  return [...new Set(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-ZÑ]+/).filter(word => word.length >= 3 && word.length <= 8 && !ignored.has(word.toLowerCase())))]
}

function selectQuestion(prompt: string, correctTerms: string[], distractors: string[], optionImages: MultipleSelectQuestion['optionImages']): MultipleSelectQuestion {
  const correct = [...new Set(correctTerms)].slice(0, 2)
  const options = [...correct, ...distractors.filter(word => !correct.includes(word))].slice(0, 4)
  while (options.length < 4) options.push(['IDEA', 'PRACTICA', 'RECURSO', 'EJEMPLO'][options.length])
  return { prompt, options, answers: correct.map((_, index) => index), optionImages: optionImages.slice(0, 4) }
}

export function getSchoolQuestionSet(courseId: string, topicTitle: string, course: SchoolSubject): AssessmentQuestionSet {
  const set = schoolQuestionMock[courseId] ?? fallbackSet
  const topicIndex = Math.max(0, course.units.findIndex(unit => unit.title === topicTitle))
  const topic = course.units[topicIndex] ?? course.units[0] ?? { title: topicTitle, description: '' }
  const otherTopicTerms = course.units.filter((_, index) => index !== topicIndex).flatMap(unit => topicWords(unit.title))
  const titleTerms = topicWords(topic.title)
  const descriptionTerms = topicWords(topic.description)
  const topicSearchWords = [...new Set([...titleTerms, ...descriptionTerms, ...set.wordSearch.words.map(word => topicWords(word)[0]).filter(Boolean)])].slice(0, 10)
  const completedSearchWords = [...topicSearchWords, ...set.wordSearch.words.filter(word => !topicSearchWords.includes(word))].slice(0, 10)
  const selectImages = set.multipleSelect.optionImages
  const override = topicAssessmentOverrides[`${courseId}:${topicIndex}`]
  const multipleChoiceVersions = override?.choices ?? [
    { prompt: `¿Qué tema estás estudiando en ${course.name}?`, options: course.units.map(unit => unit.title), answer: topicIndex },
    { prompt: `¿Qué objetivo corresponde a «${topic.title}»?`, options: course.units.map(unit => unit.description), answer: topicIndex },
    { prompt: `¿Cuál de estos temas se relaciona directamente con «${topic.title}»?`, options: [topic.title, ...course.units.filter((_, index) => index !== topicIndex).slice(0, 3).map(unit => unit.title)], answer: 0 },
  ]
  const multipleSelectVersions = override?.selects.map(question => ({ ...question, optionImages: selectImages })) ?? [
    selectQuestion(`Selecciona palabras clave que aparecen en «${topic.title}».`, titleTerms, otherTopicTerms, selectImages),
    selectQuestion(`Marca conceptos importantes para estudiar «${topic.title}».`, descriptionTerms, otherTopicTerms, selectImages),
    selectQuestion(`Elige las ideas relacionadas con el propósito de «${topic.title}».`, titleTerms.slice(-2), descriptionTerms.filter(term => !titleTerms.includes(term)).concat(otherTopicTerms), selectImages),
    selectQuestion(`Selecciona dos conceptos que ayudan a repasar «${topic.title}».`, descriptionTerms.slice(0, 2), titleTerms.concat(otherTopicTerms), selectImages),
  ]
  const versions: AssessmentQuestionSet = {
    ...set,
    matching: override?.matching ?? set.matching,
    multipleChoiceVersions,
    multipleSelectVersions,
    wordSearchVersions: [
      { ...set.wordSearch, prompt: `Encuentra vocabulario relacionado con «${topic.title}». Las palabras pueden aparecer en horizontal, vertical o diagonal.`, words: completedSearchWords, grid: createChallengeGrid(completedSearchWords, `${courseId}-${topic.title}-general`) },
      { ...set.wordSearch, prompt: `Localiza conceptos clave de «${topic.title}». Las palabras pueden aparecer en horizontal, vertical o diagonal.`, words: completedSearchWords, grid: createChallengeGrid(completedSearchWords, `${courseId}-${topic.title}-topic`) },
    ],
  }
  return getAssessmentOverride(courseId, topicTitle) ?? versions
}
