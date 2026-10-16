import { useEffect, useRef, useState } from 'react';
import { useTenant } from '../../core/TenantContext';
import { listPortalPages, loadPortalConfiguration, loadSectionCatalog, savePortal, type PortalSectionOption } from './portalService';
import { projectError } from '../projects/projectService';
import { newSnapshot, sectionTypes, textValue, type PortalSnapshot } from './contract';
import { PortalRenderer } from './PortalRenderer';
import './portal.css';
interface Draft { page_id: string; revision: number; status: string; snapshot: PortalSnapshot | null }
export function PortalEditor() {
  const { activeInstitution, institutions, setActiveInstitution } = useTenant();
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  if (!activeInstitution) return <p>Selecciona una institución.</p>;
  return <div className="portal-editor"><label>Institución <select disabled={saving} value={activeInstitution.institution_id} onChange={e => { if (unsaved && !window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de institución?')) return; setUnsaved(false); setActiveInstitution(institutions.find(i => i.institution_id === e.target.value) ?? null); }}>{institutions.map(i => <option key={i.institution_id} value={i.institution_id}>{i.name}</option>)}</select></label>
    <Editor key={activeInstitution.institution_id} institutionId={activeInstitution.institution_id} name={activeInstitution.name} slug={activeInstitution.slug} role={activeInstitution.role} onDirtyChange={setUnsaved} onBusyChange={setSaving} />
  </div>;
}
function Editor({ institutionId, name, slug, role, onDirtyChange, onBusyChange }: { institutionId: string; name: string; slug: string; role: string; onDirtyChange: (value:boolean)=>void; onBusyChange: (value:boolean)=>void }) {
  const [pages, setPages] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [snapshot, setSnapshot] = useState(() => newSnapshot(name));
  const [configuration, setConfiguration] = useState<PortalSnapshot|null>(null);
  const [catalog, setCatalog] = useState<PortalSectionOption[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const inFlight = useRef(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false); const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const canPublish = ['super_admin','institution_admin'].includes(role);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [pageResult, configResult, catalogResult]=await Promise.allSettled([
        listPortalPages(institutionId),loadPortalConfiguration(institutionId,name),loadSectionCatalog(),
      ]);
      if(!active)return;
      if(pageResult.status==='fulfilled')setPages(pageResult.value);else setError(projectError(pageResult.reason));
      if(configResult.status==='fulfilled')setConfiguration(configResult.value);else{setConfiguration(null);setError(projectError(configResult.reason));}
      if(catalogResult.status==='fulfilled'){setCatalog(catalogResult.value);setCatalogError('');}else{setCatalog([]);setCatalogError(projectError(catalogResult.reason));}
      setLoading(false);
    })();
    return () => { active = false; };
  }, [institutionId, name, reload]);
  useEffect(()=>{if(configuration&&!selected&&!dirty)setSnapshot(structuredClone(configuration));},[configuration,selected,dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function edit(next: PortalSnapshot) { setSnapshot(next); setDirty(true); onDirtyChange(true); setMessage(''); }
  function select(page: Draft | null) {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    setSelected(page); setSnapshot(structuredClone(page?.snapshot ?? configuration ?? newSnapshot(name))); setDirty(false); onDirtyChange(false); setMessage(''); setError('');
  }
  async function save(publish: boolean) {
    if (inFlight.current) return;
    inFlight.current=true; setBusy(true); onBusyChange(true); setError(''); setMessage('');
    try {
      const ordered = { ...snapshot, sections: snapshot.sections.map((s, position) => ({ ...s, position })) };
      const data=await savePortal(institutionId,selected?.page_id??null,selected?.revision??0,ordered,publish);
      const page = { ...data, snapshot: ordered } as Draft;
      setSelected(page); setPages(old => [...old.filter(p => p.page_id !== page.page_id), page]); setDirty(false); onDirtyChange(false);
      setMessage(publish ? 'Página publicada. El portal público ya muestra esta versión.' : 'Borrador guardado. La versión pública no ha cambiado.');
    } catch (cause) { setError(projectError(cause)); }
    finally { inFlight.current=false; setBusy(false); onBusyChange(false); }
  }
  if (!['super_admin','institution_admin','editor'].includes(role)) return <p>Tu rol no permite editar el portal.</p>;
  return <>
    <h1>Editor institucional</h1><p>Diseña, revisa y publica las páginas de {name}.</p>
    <div className="editor-toolbar"><label>Página <select disabled={busy||loading} value={selected?.page_id ?? ''} onChange={e => select(pages.find(p => p.page_id === e.target.value) ?? null)}><option value="">Nueva página</option>{pages.map(p => <option key={p.page_id} value={p.page_id}>{p.snapshot?.title ?? 'Página anterior'} · {p.status}</option>)}</select></label><button type="button" disabled={busy||loading} onClick={() => { setError(''); setLoading(true); setReload(v => v+1); }}>Recargar listado</button><a href={`/portal?institution=${encodeURIComponent(slug)}&page=${encodeURIComponent(snapshot.slug)}`} target="_blank" rel="noreferrer">Ver portal público</a></div>
    {error && <p role="alert" className="editor-error">{error}</p>}{message && <p role="status" className="editor-success">{message}</p>}
    {loading&&<p role="status">Cargando configuración institucional…</p>}
    <form onSubmit={e => { e.preventDefault(); void save(false); }}>
      <fieldset disabled={busy||loading||(!selected&&!configuration)}>
        <div className="editor-grid">
          <label>Título de página<input required maxLength={255} value={snapshot.title} onChange={e => edit({ ...snapshot, title: e.target.value })} /></label>
          <label>Ruta de página<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} value={snapshot.slug} onChange={e => edit({ ...snapshot, slug: e.target.value })} /></label>
          <label>Nombre del portal<input required maxLength={255} value={snapshot.settings.site_title} onChange={e => edit({ ...snapshot, settings: { ...snapshot.settings, site_title: e.target.value } })} /></label>
          <label>Logotipo (URL HTTPS)<input type="url" value={snapshot.settings.logo_url} onChange={e => edit({ ...snapshot, settings: { ...snapshot.settings, logo_url: e.target.value } })} /></label>
          <label>Color principal<input type="color" value={snapshot.theme.primary_color} onChange={e => edit({ ...snapshot, theme: { ...snapshot.theme, primary_color: e.target.value } })} /></label>
          <label>Color secundario<input type="color" value={snapshot.theme.secondary_color} onChange={e => edit({ ...snapshot, theme: { ...snapshot.theme, secondary_color: e.target.value } })} /></label>
          <label>Tipografía<input required maxLength={100} value={snapshot.theme.font_family} onChange={e => edit({ ...snapshot, theme: { ...snapshot.theme, font_family: e.target.value } })} /></label>
          <label>Plantilla<select value={snapshot.template} onChange={e => edit({ ...snapshot, template: e.target.value as PortalSnapshot['template'] })}><option value="classic">Clásica</option><option value="cards">Tarjetas</option><option value="editorial">Editorial</option></select></label>
          <label>Pie de página<input value={snapshot.settings.footer_text} onChange={e => edit({ ...snapshot, settings: { ...snapshot.settings, footer_text: e.target.value } })} /></label>
          <label><input type="checkbox" checked={snapshot.is_homepage} onChange={e => edit({ ...snapshot, is_homepage: e.target.checked })} /> Usar como portada institucional</label>
        </div>
        <h2>Menú del portal</h2>
        {snapshot.menus.map((menu, index) => <div className="editor-toolbar" key={index}><label>Texto<input required value={menu.label} onChange={e => edit({ ...snapshot, menus: snapshot.menus.map((m,i) => i === index ? { ...m, label: e.target.value } : m) })} /></label><label>Destino<input required placeholder="/portal?institution=...&page=..." value={menu.url} onChange={e => edit({ ...snapshot, menus: snapshot.menus.map((m,i) => i === index ? { ...m, url: e.target.value } : m) })} /></label><button type="button" onClick={() => edit({ ...snapshot, menus: snapshot.menus.filter((_,i) => i !== index) })}>Quitar enlace {index+1}</button></div>)}
        <button type="button" onClick={() => edit({ ...snapshot, menus: [...snapshot.menus, { label: '', url: '' }] })}>Añadir enlace al menú</button>
        <h2>Secciones</h2><p>Noticias y personal consultan publicaciones institucionales. En eventos y reconocimientos, introduce únicamente contenido autorizado para publicación.</p>
        {snapshot.sections.map((section,index) => <section className="editor-section" key={section.id}>
          <div className="editor-toolbar"><h3>{index+1}. {sectionTypes[section.type as keyof typeof sectionTypes]??section.type}</h3>
            <label><input type="checkbox" checked={section.is_visible} onChange={e => edit({ ...snapshot, sections: snapshot.sections.map(s => s.id === section.id ? { ...s, is_visible: e.target.checked } : s) })} /> Visible</label>
            <button type="button" disabled={index===0} onClick={() => { const sections=[...snapshot.sections]; [sections[index-1],sections[index]]=[sections[index],sections[index-1]]; edit({...snapshot,sections:sections.map((s,i)=>({...s,position:i}))}); }}>Subir</button>
            <button type="button" disabled={index===snapshot.sections.length-1} onClick={() => { const sections=[...snapshot.sections]; [sections[index+1],sections[index]]=[sections[index],sections[index+1]]; edit({...snapshot,sections:sections.map((s,i)=>({...s,position:i}))}); }}>Bajar</button>
            <button type="button" onClick={() => edit({ ...snapshot, sections:snapshot.sections.filter(s=>s.id!==section.id) })}>Quitar sección</button>
          </div>
          <div className="editor-grid">{Object.entries({ title:'Título',body:'Contenido',image_url:'Imagen (URL HTTPS)',alt:'Texto alternativo',url:'Enlace (HTTPS o ruta local)',link_label:'Texto del enlace' }).map(([field,label]) => <label key={field}>{label}{field==='body' ? <textarea rows={4} value={textValue(section.properties[field])} onChange={e=>edit({...snapshot,sections:snapshot.sections.map(s=>s.id===section.id?{...s,properties:{...s.properties,[field]:e.target.value}}:s)})} /> : <input value={textValue(section.properties[field])} onChange={e=>edit({...snapshot,sections:snapshot.sections.map(s=>s.id===section.id?{...s,properties:{...s.properties,[field]:e.target.value}}:s)})} />}</label>)}</div>
        </section>)}
        {catalogError&&<p role="alert" className="editor-error">No se pudo cargar el catálogo de secciones. {catalogError}</p>}
        {!loading&&!catalogError&&!catalog.length&&<p>No hay tipos de sección compatibles habilitados.</p>}
        <label>Añadir sección <select disabled={!catalog.length} value="" onChange={e=>{const option=catalog.find(item=>item.type===e.target.value);if(option)edit({...snapshot,sections:[...snapshot.sections,{id:crypto.randomUUID(),type:option.type,position:snapshot.sections.length,is_visible:true,properties:structuredClone(option.default_properties)}]});}}><option value="">Selecciona un tipo</option>{catalog.map(({type})=><option key={type} value={type}>{sectionTypes[type as keyof typeof sectionTypes]??type}</option>)}</select></label>
        <div className="editor-toolbar"><button type="submit">Guardar borrador</button><button type="button" onClick={()=>setPreview(v=>!v)}>{preview?'Cerrar vista previa':'Previsualizar'}</button>{canPublish && <button type="button" onClick={e=>{if(e.currentTarget.form?.reportValidity() && window.confirm('¿Publicar esta página y su configuración institucional?')) void save(true);}}>Publicar página</button>}</div>
      </fieldset>
    </form>
    {preview && <section aria-label="Vista previa del borrador"><p className="editor-success">Vista previa del borrador: todavía no es pública.</p><PortalRenderer snapshot={snapshot} institutionSlug={slug} /></section>}
  </>;
}
