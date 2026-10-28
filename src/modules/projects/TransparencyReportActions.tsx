import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { notify } from '../../shared/components/Toaster/notify';
import { plural, reportFileName, fileSlug, saveBlob } from './projectPresentation';
import { ecuadorToday } from './projectValidation';
import { collectRows, transparencyXlsxSheets, type PublicProjectRow, type TransparencySource, type TransparencyQuery } from './publicTransparency';
import { buildXlsx, XLSX_MIME } from './xlsxWriter';
import { loadInstitutionBrand, type InstitutionBrand } from './institutionBrand';
import { issueDate, TransparencyPrintSheet, usePrintJob, type PublicFilters } from './PrintSheet';

type Kind = 'xlsx' | 'pdf';

interface Props {
  source: TransparencySource;
  slug: string;
  name: string;
  query: Omit<TransparencyQuery, 'page' | 'pageSize'>;
  filters: PublicFilters | null;
  disabled: boolean;
}

/** Excel and PDF of the full filtered list (every page), with the institution name, logo and colour. */
export function TransparencyReportActions({ source, slug, name, query, filters, disabled }: Props) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [rows, setRows] = useState<PublicProjectRow[] | null>(null);
  const [issuedOn, setIssuedOn] = useState('');
  const [brand, setBrand] = useState<InstitutionBrand | null>(null);
  const { printing, print } = usePrintJob();

  async function generate(kind: Kind) {
    setBusy(kind);
    try {
      const list = await collectRows(source, query);
      const today = ecuadorToday();
      if (kind === 'xlsx') {
        saveBlob(reportFileName('Transparencia', name, 'xlsx', today), new Blob([buildXlsx(transparencyXlsxSheets(name, list, issueDate(), today))], { type: XLSX_MIME }));
        notify.success('Informe descargado', { description: `${plural(list.length, 'proyecto', 'proyectos')} en formato Excel.` });
      } else {
        setBrand(await loadInstitutionBrand({ slug, name }));
        setRows(list);
        setIssuedOn(issueDate());
        print(`Transparencia_${fileSlug(name)}_${today}`);
      }
    } catch {
      notify.error('No se pudo generar el informe', { description: 'Vuelve a intentarlo en unos segundos.' });
    } finally {
      setBusy(null);
    }
  }

  const off = disabled || busy !== null || printing;
  return <>
    <button type="button" disabled={off} onClick={() => void generate('xlsx')}><FileSpreadsheet size={15} aria-hidden="true" />{busy === 'xlsx' ? 'Generando…' : 'Descargar Excel (.xlsx)'}</button>
    <button type="button" disabled={off} onClick={() => void generate('pdf')}><FileText size={15} aria-hidden="true" />{busy === 'pdf' ? 'Preparando…' : 'Descargar informe (PDF)'}</button>
    {printing && rows && brand && <TransparencyPrintSheet brand={brand} rows={rows} filters={filters} issuedOn={issuedOn} />}
  </>;
}
