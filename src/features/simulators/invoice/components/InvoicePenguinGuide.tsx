import { useEffect, useState } from 'react'
import { PenguinMascot } from '../../../courses/components/PenguinMascot'
import './InvoicePenguinGuide.css'

const tipsByStep = {
  1: [
    'Elige los productos y ajusta la cantidad. La factura se calcula con esos valores.',
    'Revisa el stock disponible y agrega solo los artículos que incluirás en la venta.',
    'Usa los botones + y − para indicar cuántas unidades lleva cada producto.',
  ],
  2: [
    'Completa los datos de emisión y del cliente antes de continuar.',
    'Verifica la identificación y el correo del cliente para que los datos queden correctos.',
    'Revisa la fecha y los datos ingresados. Luego podrás ver el total de la factura.',
  ],
  3: [
    'Aquí puedes revisar subtotal, impuestos y total antes de guardar la factura.',
    'Comprueba que los productos y los datos estén correctos. Después, guarda la factura.',
    'El total reúne los productos seleccionados y los impuestos calculados.',
  ],
} as const

type Step = keyof typeof tipsByStep

interface InvoicePenguinGuideProps {
  step: Step
  inline?: boolean
  followAtTop?: boolean
}

export function InvoicePenguinGuide({ step, inline = false, followAtTop = false }: InvoicePenguinGuideProps) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tipsByStep[step].length))
  const [nearPageEnd, setNearPageEnd] = useState(false)
  const message = tipsByStep[step][tipIndex]

  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * tipsByStep[step].length))
  }, [step])

  useEffect(() => {
    const updatePosition = () => {
      const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      setNearPageEnd(window.scrollY + window.innerHeight >= pageHeight - 120)
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, { passive: true })
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [])

  const positionClasses = [
    inline && 'is-inline',
    !inline && !followAtTop && nearPageEnd && 'is-raised',
    !inline && !followAtTop && (step === 2 || step === 3) && 'is-later-step',
    followAtTop && 'is-top-follow',
  ].filter(Boolean).join(' ')

  return <aside className={`invoice-penguin-guide ${positionClasses}`} aria-label="Ayuda del simulador">
    <div className="invoice-penguin-guide-bubble">
      <p>{message}</p>
    </div>
    <PenguinMascot expression="curious" />
  </aside>
}
