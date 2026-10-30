import { useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { ConverterPage } from '../converter/pages/ConverterPage';
import { InterestSimulatorPage } from '../interest/pages/InterestSimulatorPage';
import { InvoiceSimulatorPage } from '../invoice/pages/InvoiceSimulatorPage';
import './PortalSimulatorsPage.css';

export type PanelSimulatorKind = 'invoice' | 'converter' | 'interest';

/** One simulator inside the private workspace; the sidebar is the only navigation, so there is no hub or second menu. */
export function PanelSimulator({ kind }: { kind: PanelSimulatorKind }) {
  const [section, setSection] = useState<'emission' | 'history'>('emission');
  const [count, setCount] = useState(0);
  return <div className="portal-simulators" data-theme="light">
    {kind === 'invoice' && <div className="portal-simulators-toolbar">
      <nav className="portal-invoice-tabs" aria-label="Secciones de facturación" role="tablist">
        <button type="button" role="tab" aria-selected={section === 'emission'} onClick={() => setSection('emission')}><FileText size={18} aria-hidden="true" /> Emisión</button>
        <button type="button" role="tab" aria-selected={section === 'history'} onClick={() => setSection('history')}><FolderOpen size={18} aria-hidden="true" /> Facturas <span>{count}</span></button>
      </nav>
    </div>}
    {kind === 'invoice' ? <InvoiceSimulatorPage activeSection={section} onSectionChange={setSection} onInvoiceCountChange={setCount} />
      : kind === 'converter' ? <ConverterPage /> : <InterestSimulatorPage />}
  </div>;
}
