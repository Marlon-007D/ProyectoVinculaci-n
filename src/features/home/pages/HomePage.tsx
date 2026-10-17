import { useEffect, useState } from 'react'
import { ArrowRight, ArrowRightLeft, BarChart3, Calculator, FileText, GraduationCap, ReceiptText } from 'lucide-react'
import type { AppRoute } from '../../../app/router/AppRouter'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'
import { PenguinMascot } from '../../courses/components/PenguinMascot'
import './HomePage.css'

interface Shortcut { route: AppRoute; title: string; description: string; Icon: typeof ReceiptText; image: string; imageAlt: string; messages: string[] }
const shortcuts: Shortcut[] = [
  { route: 'invoice', title: 'Facturación electrónica', description: 'Arma una factura y revisa sus totales.', Icon: ReceiptText, image: '/images/home/facturacion.jpg', imageAlt: 'Persona revisando documentos y una factura en su escritorio', messages: ['Cada producto pone un ladrillo; juntos construyen el total de tu factura.', 'El historial guarda las huellas de tus facturas para que vuelvas a ellas.', 'Diez dígitos son la llave que abre el siguiente paso de la emisión.'] },
  { route: 'converter', title: 'Unidades y monedas', description: 'Convierte cantidades y consulta equivalencias.', Icon: ArrowRightLeft, image: '/images/home/monedas.jpg', imageAlt: 'Puesto de cambio de moneda con sus tasas visibles', messages: ['Las unidades cambian de traje, pero la cantidad conserva su valor.', 'Con las flechas puedes cambiar el rumbo de la conversión.'] },
  { route: 'interest', title: 'Interés simple y compuesto', description: 'Compara el monto según el plazo y la tasa.', Icon: Calculator, image: '/images/home/interes.jpg', imageAlt: 'Calculadora y gráficos financieros en una mesa de trabajo', messages: ['El tiempo hace crecer el capital: prueba ambas rutas y compara.', 'En el interés compuesto, cada período impulsa al siguiente.'] },
  { route: 'school-courses', title: 'Cursos', description: 'Continúa con los módulos y sus contenidos.', Icon: GraduationCap, image: '/images/home/cursos.jpg', imageAlt: 'Estudiantes leyendo libros en un aula iluminada', messages: ['Cada módulo es una puerta a nuevos temas y actividades.', 'Abre un módulo y deja que sus contenidos te guíen paso a paso.'] },
  { route: 'reports-hub', title: 'Reportes', description: 'Consulta publicaciones y datos académicos.', Icon: FileText, image: '/images/home/reportes.jpg', imageAlt: 'Dos personas revisando documentos y reportes en una oficina', messages: ['Las publicaciones son ventanas a lo que ocurre en la institución.', 'En reportes, cada sección cuenta una parte de la vida académica.'] },
]

interface TalkingTip { shortcutIndex: number; messageIndex: number }

interface Props { onSelect?: (route: AppRoute) => void; onPreview?: (entry: AcademicContentEntry) => void }

export function HomePage({ onSelect }: Props) {
  const [tip, setTip] = useState<TalkingTip>(() => ({ shortcutIndex: 0, messageIndex: Math.floor(Math.random() * shortcuts[0].messages.length) }))
  const [typedMessage, setTypedMessage] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const currentShortcut = shortcuts[tip.shortcutIndex]
  const currentMessage = currentShortcut.messages[tip.messageIndex]

  useEffect(() => {
    const timer = window.setInterval(() => setTip(current => {
      const shortcutIndex = (current.shortcutIndex + 1) % shortcuts.length
      return { shortcutIndex, messageIndex: Math.floor(Math.random() * shortcuts[shortcutIndex].messages.length) }
    }), 7000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let characterIndex = 0
    setTypedMessage('')
    setIsTyping(true)
    const timer = window.setInterval(() => {
      characterIndex += 1
      setTypedMessage(currentMessage.slice(0, characterIndex))
      if (characterIndex >= currentMessage.length) {
        window.clearInterval(timer)
        setIsTyping(false)
      }
    }, 28)
    return () => window.clearInterval(timer)
  }, [currentMessage])

  return <section className="page-content home-page">
    <header className="home-heading"><h1>Hola, ¿qué te gustaría aprender hoy?</h1></header>
    <div className="home-section-heading"><div><span>ACCESOS DIRECTOS</span><h2 id="home-shortcuts-title">Empieza por aquí</h2></div></div>
    <div className="home-dashboard">
      <section className="home-shortcuts" aria-labelledby="home-shortcuts-title">
        <button type="button" key={currentShortcut.route} className="home-shortcut-card" onClick={() => onSelect?.(currentShortcut.route)} aria-label={`${currentShortcut.title}. ${currentShortcut.description}`}>
          <img className="home-shortcut-photo" src={currentShortcut.image} alt={currentShortcut.imageAlt} />
          <span className="home-shortcut-icon"><currentShortcut.Icon size={22} /></span>
          <span className="home-shortcut-copy"><strong>{currentShortcut.title}</strong><small>{currentShortcut.description}</small></span>
          <span className="home-shortcut-arrow"><ArrowRight size={19} /></span>
        </button>
      </section>
      <aside className="home-penguin-panel" aria-label="Consejo del pingüino">
        <div className="home-penguin-speech"><p>{typedMessage}{isTyping && <span className="home-typing-cursor" aria-hidden="true" />}</p></div>
        <div className="home-penguin-character"><PenguinMascot expression="happy" /></div>
      </aside>
    </div>
  </section>
}
