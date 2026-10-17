import { useEffect, useState } from 'react'
import { ArrowRight, ArrowRightLeft, BarChart3, Calculator, FileText, GraduationCap, ReceiptText } from 'lucide-react'
import type { AppRoute } from '../../../app/router/AppRouter'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'
import { PenguinMascot } from '../../courses/components/PenguinMascot'
import './HomePage.css'

interface Shortcut { route: AppRoute; title: string; description: string; Icon: typeof ReceiptText; messages: string[] }
const shortcuts: Shortcut[] = [
  { route: 'invoice', title: 'Facturación electrónica', description: 'Arma una factura y revisa sus totales.', Icon: ReceiptText, messages: ['Cada producto pone un ladrillo; juntos construyen el total de tu factura.', 'El historial guarda las huellas de tus facturas para que vuelvas a ellas.', 'Diez dígitos son la llave que abre el siguiente paso de la emisión.'] },
  { route: 'converter', title: 'Unidades y monedas', description: 'Convierte cantidades y consulta equivalencias.', Icon: ArrowRightLeft, messages: ['Las unidades cambian de traje, pero la cantidad conserva su valor.', 'Con las flechas puedes cambiar el rumbo de la conversión.'] },
  { route: 'interest', title: 'Interés simple y compuesto', description: 'Compara el monto según el plazo y la tasa.', Icon: Calculator, messages: ['El tiempo hace crecer el capital: prueba ambas rutas y compara.', 'En el interés compuesto, cada período impulsa al siguiente.'] },
  { route: 'school-courses', title: 'Cursos', description: 'Continúa con los módulos y sus contenidos.', Icon: GraduationCap, messages: ['Cada módulo es una puerta a nuevos temas y actividades.', 'Abre un módulo y deja que sus contenidos te guíen paso a paso.'] },
  { route: 'reports-hub', title: 'Reportes', description: 'Consulta publicaciones y datos académicos.', Icon: FileText, messages: ['Las publicaciones son ventanas a lo que ocurre en la institución.', 'En reportes, cada sección cuenta una parte de la vida académica.'] },
]

interface TalkingTip { shortcutIndex: number; messageIndex: number }
function randomTip(excludeIndex?: number): TalkingTip {
  let shortcutIndex = Math.floor(Math.random() * shortcuts.length)
  if (shortcuts.length > 1 && shortcutIndex === excludeIndex) shortcutIndex = (shortcutIndex + 1 + Math.floor(Math.random() * (shortcuts.length - 1))) % shortcuts.length
  return { shortcutIndex, messageIndex: Math.floor(Math.random() * shortcuts[shortcutIndex].messages.length) }
}

interface Props { onSelect?: (route: AppRoute) => void; onPreview?: (entry: AcademicContentEntry) => void }

export function HomePage({ onSelect }: Props) {
  const [tip, setTip] = useState<TalkingTip>(() => randomTip())
  const [typedMessage, setTypedMessage] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const currentShortcut = shortcuts[tip.shortcutIndex]
  const currentMessage = currentShortcut.messages[tip.messageIndex]

  useEffect(() => {
    const timer = window.setInterval(() => setTip(current => randomTip(current.shortcutIndex)), 7000)
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
    <div className="home-dashboard">
      <section className="home-shortcuts" aria-labelledby="home-shortcuts-title">
        <div className="home-section-heading"><div><span>ACCESOS DIRECTOS</span><h2 id="home-shortcuts-title">Empieza por aquí</h2></div></div>
        <div className="home-shortcut-grid">
          {shortcuts.map(({ route, title, description, Icon }, index) => <button type="button" key={route} className={`home-shortcut-card${tip.shortcutIndex === index ? ' is-penguin-topic' : ''}`} onClick={() => onSelect?.(route)}><span className="home-shortcut-icon"><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={17} /></button>)}
        </div>
      </section>
      <aside className="home-penguin-panel" aria-label="Consejo del pingüino">
        <div className="home-penguin-speech"><p>{typedMessage}{isTyping && <span className="home-typing-cursor" aria-hidden="true" />}</p></div>
        <div className="home-penguin-character"><PenguinMascot expression="happy" /></div>
      </aside>
    </div>
  </section>
}
