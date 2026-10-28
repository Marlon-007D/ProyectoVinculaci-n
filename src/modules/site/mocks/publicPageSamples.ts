import type { PageSection } from "../types/page";

const classroomImages = {
  preschool: "https://images.unsplash.com/photo-1623287072802-ca4ecbec4861?auto=format&fit=crop&w=1000&q=82",
  elementary: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=82",
  highSchool: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1000&q=82",
  community: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=82",
  learning: "https://images.unsplash.com/photo-1473649085228-583485e6e4d7?auto=format&fit=crop&w=1000&q=82",
} as const;

const levels = [
  {
    title: "Preescolar",
    description: "Aprendizaje inicial a través del juego, la exploración y experiencias cercanas a su entorno.",
    image_url: classroomImages.preschool,
    image_alt: "Niños participan en una actividad de aprendizaje en el aula",
    url: "/?slug=contacto",
    link_label: "Leer más",
  },
  {
    title: "Educación básica",
    description: "Fortalecemos conocimientos, autonomía y pensamiento crítico en cada etapa escolar.",
    image_url: classroomImages.elementary,
    image_alt: "Estudiantes aprenden y colaboran en el aula",
    url: "/?slug=contacto",
    link_label: "Leer más",
  },
  {
    title: "Bachillerato",
    description: "Acompañamos la preparación académica y vocacional para nuevos estudios y proyectos de vida.",
    image_url: classroomImages.highSchool,
    image_alt: "Estudiantes de bachillerato participan en una clase",
    url: "/?slug=contacto",
    link_label: "Leer más",
  },
];

export const PUBLIC_PAGE_SAMPLES: Record<string, PageSection[]> = {
  nosotros: [
    {
      id: "sample-about-intro",
      type: "banner",
      position: -3,
      is_visible: true,
      properties: {
        eyebrow: "Nuestra comunidad",
        title: "Nosotros",
        subtitle: "Una comunidad educativa que aprende, crece y construye su futuro en conjunto.",
      },
    },
    {
      id: "sample-about-story",
      type: "text",
      position: 1,
      is_visible: true,
      properties: {
        layout: "story",
        eyebrow: "Nuestra historia",
        title: "Un proyecto educativo que crece con su comunidad",
        body: "Desde sus primeros años, la institución ha crecido junto a las familias de su comunidad. Su propuesta reúne aprendizajes académicos, formación en valores y acompañamiento cercano para que cada estudiante avance con confianza.\n\nHoy seguimos construyendo ese camino con espacios para descubrir, colaborar y desarrollar nuevas ideas.",
        image_url: classroomImages.community,
        alt: "Estudiantes comparten una actividad de aprendizaje",
      },
    },
    {
      id: "sample-about-purpose",
      type: "text",
      position: 2,
      is_visible: true,
      properties: {
        tone: "tint",
        title: "Lo que nos guía",
        items: [
          { title: "Misión", description: "Ofrecer una formación integral con experiencias activas y acompañamiento para cada estudiante." },
          { title: "Visión", description: "Ser una comunidad que inspira a aprender, convivir y participar con responsabilidad." },
          { title: "Valores", description: "Respeto, responsabilidad, solidaridad y curiosidad por aprender." },
        ],
      },
    },
    {
      id: "sample-about-gallery",
      type: "gallery",
      position: 3,
      is_visible: true,
      properties: {
        title: "Aprender en comunidad",
        items: [
          { image_url: classroomImages.learning, alt: "Estudiantes trabajan en una actividad escolar", caption: "Aprendizaje colaborativo" },
          { image_url: classroomImages.elementary, alt: "Aula preparada para una jornada de aprendizaje", caption: "Espacios para descubrir" },
          { image_url: classroomImages.highSchool, alt: "Estudiantes participan en una clase", caption: "Ideas que abren caminos" },
        ],
      },
    },
  ],
  "oferta-educativa": [
    {
      id: "sample-offer-intro",
      type: "banner",
      position: -3,
      is_visible: true,
      properties: {
        eyebrow: "Propuesta educativa",
        title: "Oferta educativa",
        subtitle: "Acompañamos cada etapa con experiencias de aprendizaje adecuadas a la edad y al desarrollo de cada estudiante.",
      },
    },
    {
      id: "sample-offer-levels",
      type: "text",
      position: 1,
      is_visible: true,
      properties: {
        layout: "education-levels",
        title: "Niveles educativos",
        body: "Un recorrido de aprendizaje continuo, desde los primeros descubrimientos hasta la preparación para nuevos proyectos.",
        items: levels,
      },
    },
  ],
  contacto: [
    {
      id: "sample-contact-intro",
      type: "banner",
      position: -3,
      is_visible: true,
      properties: {
        eyebrow: "Estamos para ayudarte",
        title: "Contacto",
        subtitle: "Comunícate con nuestro equipo para resolver tus consultas o conocer la propuesta educativa.",
      },
    },
    {
      id: "sample-contact-details",
      type: "text",
      position: 1,
      is_visible: true,
      properties: {
        layout: "contact-grid",
        title: "Información de contacto",
        body: "Puedes escribirnos, llamarnos o visitarnos durante el horario de atención.",
        items: [
          { title: "Teléfono", description: "+593 4 500 0000", url: "tel:+59345000000", icon: "call" },
          { title: "Correo electrónico", description: "contacto@institucion-demo.edu.ec", url: "mailto:contacto@institucion-demo.edu.ec", icon: "mail" },
          { title: "Dirección", description: "Av. Principal y Calle Los Cedros, Guayaquil, Ecuador.", icon: "location_on" },
          { title: "Horario de atención", description: "Lunes a viernes, de 07:00 a 16:00.", icon: "schedule" },
        ],
      },
    },
  ],
};

export const EDUCATION_LEVEL_IMAGES = classroomImages;
