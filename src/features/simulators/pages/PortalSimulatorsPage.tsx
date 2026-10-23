import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConverterPage } from '../converter/pages/ConverterPage'
import { InterestSimulatorPage } from '../interest/pages/InterestSimulatorPage'
import { InvoiceSimulatorPage } from '../invoice/pages/InvoiceSimulatorPage'
import { SimulatorHubPage } from './SimulatorHubPage'
import './PortalSimulatorsPage.css'

type SimulatorRoute = 'invoice' | 'converter' | 'interest'

export function PortalSimulatorsPage() {
  const [params, setParams] = useSearchParams()
  const selectedValue = params.get('simulator')
  const selected: SimulatorRoute | null = selectedValue === 'invoice' || selectedValue === 'converter' || selectedValue === 'interest' ? selectedValue : null
  const [invoiceSection, setInvoiceSection] = useState<'emission' | 'history'>('emission')
  const [invoiceCount, setInvoiceCount] = useState(0)

  const selectSimulator = (route: SimulatorRoute) => {
    const next = new URLSearchParams(params)
    next.set('slug', 'simuladores')
    next.set('simulator', route)
    setParams(next)
  }

  const returnToHub = () => {
    const next = new URLSearchParams(params)
    next.set('slug', 'simuladores')
    next.delete('simulator')
    setParams(next)
  }

  if (!selected) return <div className="portal-simulators"><SimulatorHubPage onSelect={selectSimulator} /></div>

  return (
    <div className="portal-simulators">
      <div className="portal-simulators-toolbar">
        <button className="portal-simulators-back" type="button" onClick={returnToHub}>
          <span className="portal-material-icon" aria-hidden="true">home</span> Inicio
        </button>
        {selected === 'invoice' && (
          <nav className="portal-invoice-tabs" aria-label="Secciones de facturación" role="tablist">
            <button type="button" role="tab" aria-selected={invoiceSection === 'emission'} onClick={() => setInvoiceSection('emission')}>
              <span className="portal-material-icon" aria-hidden="true">description</span> Emisión
            </button>
            <button type="button" role="tab" aria-selected={invoiceSection === 'history'} onClick={() => setInvoiceSection('history')}>
              <span className="portal-material-icon" aria-hidden="true">folder_open</span> Facturas <span>{invoiceCount}</span>
            </button>
          </nav>
        )}
      </div>
      {selected === 'invoice' ? (
        <InvoiceSimulatorPage
          activeSection={invoiceSection}
          onSectionChange={setInvoiceSection}
          onInvoiceCountChange={setInvoiceCount}
        />
      ) : selected === 'converter' ? <ConverterPage /> : <InterestSimulatorPage />}
    </div>
  )
}
