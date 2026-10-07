import { useConverter } from '../hooks/useConverter'
import { ConverterForm } from '../components/ConverterForm'
import { ConverterResult } from '../components/ConverterResult'
import './ConverterPage.css'

export function ConverterPage() {
  const converter = useConverter()
  return <section className="page-content converter-page">
    <div className="simulator-grid"><ConverterForm {...converter} onKind={converter.changeKind} onAmount={converter.setAmount} onFrom={converter.setFrom} onTo={converter.setTo} onSwap={converter.swap} /><ConverterResult {...converter} /></div>
  </section>
}
