import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publicModuleEnabled } from '../../core/institutionService';
import { InvoiceSimulatorPage } from '../../features/simulators/invoice/pages/InvoiceSimulatorPage';
import { ConverterPage } from '../../features/simulators/converter/pages/ConverterPage';
import { InterestSimulatorPage } from '../../features/simulators/interest/pages/InterestSimulatorPage';
export function PublicLearning() {
  const [params]=useSearchParams(); const slug=params.get('institution')??'';
  const [state,setState]=useState<{slug:string;allowed:boolean;error:boolean}|null>(null);
  const [tab,setTab]=useState('invoice');
  useEffect(()=>{let active=true;void(async()=>{
    try{const allowed=await publicModuleEnabled(slug,'simuladores');if(active)setState({slug,allowed,error:false});}
    catch{if(active)setState({slug,allowed:false,error:true});}
  })();return()=>{active=false;};},[slug]);
  if(!slug)return <p className="p-8">Abre los simuladores desde el portal de tu institución.</p>;
  if(state?.slug!==slug)return <p role="status" className="p-8">Comprobando disponibilidad…</p>;
  if(state.error)return <p role="alert" className="p-8">No se pudo consultar la disponibilidad de los simuladores.</p>;
  if(!state.allowed)return <p className="p-8">Los simuladores no están habilitados para esta institución.</p>;
  return <div className="mx-auto max-w-6xl p-5"><h1 className="text-2xl font-bold">Simuladores educativos</h1><nav className="my-4 flex flex-wrap gap-3" aria-label="Simuladores">{[['invoice','Facturación didáctica'],['converter','Unidades y monedas'],['interest','Interés financiero']].map(([id,label])=><button key={id} aria-pressed={tab===id} className="rounded border bg-white px-4 py-2" onClick={()=>setTab(id)}>{label}</button>)}</nav>{tab==='invoice'?<InvoiceSimulatorPage/>:tab==='converter'?<ConverterPage/>:<InterestSimulatorPage/>}</div>;
}
