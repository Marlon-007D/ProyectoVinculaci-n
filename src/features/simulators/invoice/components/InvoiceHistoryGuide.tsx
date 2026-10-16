import { useEffect, useState } from 'react'
import { PenguinMascot } from '../../../courses/components/PenguinMascot'
import './InvoiceHistoryGuide.css'

const savedInvoiceTips = [
  'Selecciona Editar para volver a cargar una factura y revisar sus datos.',
  'Compara el total guardado con los productos y el IVA antes de editar.',
  'El historial reúne las facturas de práctica que guardaste en este simulador.',
  'Usa el botón de eliminar para quitar una factura de este historial.',
]

const emptyHistoryTips = [
  'Empieza en Emisión: elige productos, completa los datos y revisa el total.',
  'Cuando guardes una factura de práctica, podrás consultarla aquí.',
  'Puedes practicar con distintos productos y datos antes de guardar una factura.',
]

export function InvoiceHistoryGuide({ hasInvoices }: { hasInvoices: boolean }) {
  const tips = hasInvoices ? savedInvoiceTips : emptyHistoryTips
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))

  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * tips.length))
  }, [hasInvoices, tips.length])

  return <aside className="invoice-history-guide" aria-label="Consejos del historial de facturas">
    <div className="invoice-history-guide-bubble" aria-live="polite"><p>{tips[tipIndex]}</p></div>
    <PenguinMascot expression="curious" />
  </aside>
}
