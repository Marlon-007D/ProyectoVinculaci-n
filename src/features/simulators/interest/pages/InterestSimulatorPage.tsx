import { InterestForm } from '../components/InterestForm'
import { InterestResult } from '../components/InterestResult'
import { useInterestSimulator } from '../hooks/useInterestSimulator'
import './InterestSimulatorPage.css'

export function InterestSimulatorPage() {
  const interest = useInterestSimulator()
  return <section className="page-content interest-page">
    <div className="simulator-grid"><InterestForm mode={interest.mode} principal={interest.principal} annualRate={interest.annualRate} years={interest.years} frequency={interest.frequency} onMode={interest.setMode} onPrincipal={interest.setPrincipal} onRate={interest.setAnnualRate} onYears={interest.setYears} onFrequency={interest.setFrequency} /><InterestResult principal={interest.principal} amount={interest.amount} isValid={interest.isValid} onReset={interest.reset} /></div>
  </section>
}
