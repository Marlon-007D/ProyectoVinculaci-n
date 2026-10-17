import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import type { SavedInvoice } from '../types/invoice.types'
import { useInvoiceSimulator } from '../hooks/useInvoiceSimulator'
import { InvoiceForm } from '../components/InvoiceForm'
import { InvoiceResult } from '../components/InvoiceResult'
import { InvoiceHistory } from '../components/InvoiceHistory'
import './InvoiceSimulatorPage.css'

interface Props {
  activeSection: 'emission' | 'history'
  onSectionChange: (section: 'emission' | 'history') => void
  onInvoiceCountChange: (count: number) => void
}

export function InvoiceSimulatorPage({ activeSection, onSectionChange, onInvoiceCountChange }: Props) {
  const invoice = useInvoiceSimulator()
  const pageRef = useRef<HTMLElement>(null)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)
  const [isSaving, setIsSaving] = useState(false)
  const [editToast, setEditToast] = useState(false)
  useEffect(() => onInvoiceCountChange(invoice.savedInvoices.length), [invoice.savedInvoices.length, onInvoiceCountChange])
  useEffect(() => {
    if (!editToast) return
    const timeoutId = window.setTimeout(() => setEditToast(false), 7000)
    return () => window.clearTimeout(timeoutId)
  }, [editToast])
  const handleEdit = (record: SavedInvoice) => {
    invoice.load(record)
    onSectionChange('emission')
    setActiveStep(1)
    setEditToast(true)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    pageRef.current?.scrollIntoView({ behavior, block: 'start' })
  }
  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    await new Promise(resolve => window.setTimeout(resolve, 350))
    const saved = await invoice.persist()
    setIsSaving(false)
    if (saved) {
      onSectionChange('history')
      setActiveStep(1)
    }
  }
  const steps = [
    { id: 1, label: 'Productos', shortLabel: 'Productos' },
    { id: 2, label: 'Datos de emisión', shortLabel: 'Emisión' },
    { id: 3, label: 'Total factura', shortLabel: 'Total' },
  ] as const
  return <section className="page-content invoice-page" ref={pageRef}>
    <div className="workspace workspace-single">
      {activeSection === 'emission' && <div className="invoice-emission-panel" id="invoice-panel-emission" role="tabpanel" aria-labelledby="invoice-tab-emission">
        <nav className="invoice-stepper" aria-label="Pasos de emisión de factura">
            <ol>{steps.map(step => <li key={step.id} className={activeStep === step.id ? 'is-current' : activeStep > step.id ? 'is-complete' : ''} aria-current={activeStep === step.id ? 'step' : undefined}>
              <button type="button" onClick={() => step.id < activeStep && setActiveStep(step.id)} disabled={step.id > activeStep} aria-label={`Paso ${step.id}: ${step.label}`}><span className="invoice-step-number">{activeStep > step.id ? <Check size={14} aria-hidden="true" /> : step.id}</span><span className="invoice-step-name">{step.label}</span><span className="invoice-step-name-short" aria-hidden="true">{step.shortLabel}</span></button>
            </li>)}</ol>
        </nav>
        {activeStep < 3 && <div className="invoice-form-column">{invoice.catalogNotice && !invoice.isCatalogLoading && <p className="invoice-save-error" role="alert">{invoice.catalogNotice}</p>}<InvoiceForm activeStep={activeStep as 1 | 2} isLoading={invoice.isCatalogLoading} draft={invoice.draft} products={invoice.products} onField={invoice.updateField} onUpdate={invoice.updateLine} onAdd={invoice.addLine} onSetQuantity={invoice.setProductQuantity} onRemove={invoice.removeLine} onNext={() => setActiveStep(current => Math.min(3, current + 1) as 1 | 2 | 3)} onPrevious={() => setActiveStep(1)} />
          {editToast && <div className="edit-toast" role="status">Factura cargada para editar.</div>}
        </div>}
        {activeStep === 3 && <div className="invoice-total-step"><InvoiceResult totals={invoice.totals} lines={invoice.draft.lines} />
          {invoice.historyNotice && <p className="invoice-save-error" role="alert">{invoice.historyNotice}</p>}
          <div className="invoice-total-navigation" role="group" aria-label="Acciones de factura"><button type="button" onClick={() => setActiveStep(2)} disabled={isSaving}>Anterior</button><button type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? <><LoaderCircle className="invoice-loader" size={18} aria-hidden="true" /> Guardando...</> : 'Guardar factura'}</button></div>
        </div>}
      </div>}
      {activeSection === 'history' && <div className="invoice-history-panel" id="invoice-panel-history" role="tabpanel" aria-labelledby="invoice-tab-history"><div className="invoice-history-layout"><InvoiceHistory invoices={invoice.savedInvoices} notice={invoice.historyNotice} isLoading={invoice.isHistoryLoading} onLoad={handleEdit} onDelete={invoice.removeSaved} /></div></div>}
    </div>
  </section>
}
