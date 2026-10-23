import { SectionDetails } from './SectionDetails';
import {moduleClass} from './portalStyles';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, Globe2, LayoutTemplate, Monitor, RefreshCw, Save, Smartphone, Trash2 } from 'lucide-react';
import { useTenant } from '../../core/TenantContext';
import { listPortalPages, loadPortalConfiguration, loadSectionCatalog, savePortal, type PortalDraft, type PortalSectionOption } from './portalService';
import { projectError } from '../projects/projectService';
import { newSnapshot, sectionTypes, textValue, withCurrentIdentity, type PortalSnapshot } from './contract';
import { PortalRenderer } from './PortalRenderer';
import { PortalImageInput } from './PortalImageInput';
import { PortalPreviewFrame } from './PortalPreviewFrame';
import { conflictingPortalPage, initialPortalPage, portalDuplicateMessage } from './portalSelection';
const templates = [
    { id: 'classic', name: 'Institucional', description: 'Portada amplia y lectura ordenada.' },
    { id: 'cards', name: 'Tarjetas', description: 'Bloques visuales en una cuadrícula.' },
    { id: 'editorial', name: 'Editorial', description: 'Contenido centrado y lectura cómoda.' },
] as const;
const fonts = ['Arial', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'system-ui'];
const connected = new Set(['news', 'events', 'staff', 'honors']);
export function PortalEditor() {
    const { activeInstitution, institutions, setActiveInstitution } = useTenant();
    const [saving, setSaving] = useState(false);
    const [unsaved, setUnsaved] = useState(false);
    if (!activeInstitution)
        return <p>Selecciona una institución.</p>;
    return <div className={moduleClass("portal-editor")}>
    <div className={moduleClass("editor-institution")}><Globe2 size={18} aria-hidden="true"/><label>Institución
      <select disabled={saving} value={activeInstitution.institution_id} onChange={event => {
            if (unsaved && !window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de institución?'))
                return;
            setUnsaved(false);
            setActiveInstitution(institutions.find(item => item.institution_id === event.target.value) ?? null);
        }}>{institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}</select>
    </label></div>
    <Editor key={activeInstitution.institution_id} institutionId={activeInstitution.institution_id} name={activeInstitution.name} slug={activeInstitution.slug} role={activeInstitution.role} onDirtyChange={setUnsaved} onBusyChange={setSaving}/>
  </div>;
}
interface EditorProps {
    institutionId: string;
    name: string;
    slug: string;
    role: string;
    onDirtyChange: (value: boolean) => void;
    onBusyChange: (value: boolean) => void;
}
function Editor({ institutionId, name, slug, role, onDirtyChange, onBusyChange }: EditorProps) {
    const [pages, setPages] = useState<PortalDraft[]>([]);
    const [selected, setSelected] = useState<PortalDraft | null>(null);
    const [snapshot, setSnapshot] = useState(() => newSnapshot(name));
    const [configuration, setConfiguration] = useState<PortalSnapshot | null>(null);
    const [catalog, setCatalog] = useState<PortalSectionOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [dirty, setDirty] = useState(false);
    const [preview, setPreview] = useState(true);
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [widePreview, setWidePreview] = useState(false);
    const [reload, setReload] = useState(0);
    const inFlight = useRef(false);
    const dirtyRef = useRef(false);
    const selectedId = useRef<string | null>(null);
    const canPublish = ['super_admin', 'institution_admin'].includes(role);
    const disabled = busy || uploading || loading || loadFailed;
    useEffect(() => {
        let active = true;
        void (async () => {
            const results = await Promise.allSettled([listPortalPages(institutionId), loadPortalConfiguration(institutionId, name), loadSectionCatalog()]);
            if (!active)
                return;
            const [pageResult, configResult, catalogResult] = results;
            const failure = results.find(result => result.status === 'rejected');
            setLoadFailed(Boolean(failure));
            if (pageResult.status === 'fulfilled' && configResult.status === 'fulfilled' && catalogResult.status === 'fulfilled') {
                const page = initialPortalPage(pageResult.value, selectedId.current);
                setPages(pageResult.value);
                setSelected(page);
                selectedId.current = page?.page_id ?? null;
                setConfiguration(configResult.value);
                setSnapshot(structuredClone(page?.snapshot ?? configResult.value));
                setCatalog(catalogResult.value);
            }
            if (failure?.status === 'rejected')
                setError(projectError(failure.reason));
            setLoading(false);
        })();
        return () => { active = false; };
    }, [institutionId, name, reload]);
    useEffect(() => {
        const warn = (event: Event) => { if (dirtyRef.current)
            event.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        window.addEventListener('portal-editor-before-leave', warn);
        return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('portal-editor-before-leave', warn); };
    }, []);
    function markDirty(value: boolean) { dirtyRef.current = value; setDirty(value); onDirtyChange(value); }
    function edit(next: PortalSnapshot) { setSnapshot(next); markDirty(true); setMessage(''); }
    function select(page: PortalDraft | null) {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?'))
            return;
        setSelected(page);
        selectedId.current = page?.page_id ?? null;
        setSnapshot(structuredClone(page?.snapshot ?? configuration ?? newSnapshot(name)));
        markDirty(false);
        setError('');
        setMessage('');
    }
    function refresh() {
        if (dirty && !window.confirm('¿Descartar los cambios sin guardar y recargar?'))
            return;
        setSelected(null);
        markDirty(false);
        setError('');
        setMessage('');
        setLoading(true);
        setReload(value => value + 1);
    }
    function imageBusy(value: boolean) { setUploading(value); onBusyChange(value); }
    function updateSection(id: string, field: string, value: string) {
        edit({ ...snapshot, sections: snapshot.sections.map(section => section.id === id ? { ...section, properties: { ...section.properties, [field]: value } } : section) });
    }
    function moveSection(index: number, direction: number) {
        const sections = [...snapshot.sections];
        [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]];
        edit({ ...snapshot, sections: sections.map((section, position) => ({ ...section, position })) });
    }
    async function save(publish: boolean) {
        if (inFlight.current || disabled)
            return;
        const duplicate = conflictingPortalPage(pages, selected?.page_id ?? null, snapshot.slug);
        if (duplicate) {
            setError(`La dirección «${snapshot.slug}» ya pertenece a «${duplicate.snapshot.title}». Selecciona esa página para editarla o usa otra dirección para una página nueva. Tus cambios siguen en el formulario.`);
            return;
        }
        inFlight.current = true;
        setBusy(true);
        onBusyChange(true);
        setError('');
        setMessage('');
        try {
            const ordered = { ...snapshot, sections: snapshot.sections.map((section, position) => ({ ...section, position })) };
            const saved = await savePortal(institutionId, selected?.page_id ?? null, selected?.revision ?? 0, ordered, publish);
            const data = { ...saved, published_slug: publish ? saved.snapshot.slug : selected?.published_slug };
            setSelected(data);
            selectedId.current = data.page_id;
            setSnapshot(data.snapshot);
            setPages(old => [...old.filter(page => page.page_id !== data.page_id).map(page => publish ? {...page,snapshot:withCurrentIdentity(page.snapshot,data.snapshot)} : page), data]);
            if (publish) setConfiguration(data.snapshot);
            markDirty(false);
            setMessage(publish ? 'Cambios publicados en el portal institucional. Ya están disponibles para los visitantes.' : 'Borrador guardado. Tu portal público conserva su versión anterior.');
        }
        catch (cause) {
            setError(portalDuplicateMessage(cause) ?? projectError(cause));
        }
        finally {
            inFlight.current = false;
            setBusy(false);
            onBusyChange(false);
        }
    }
    if (!['super_admin', 'institution_admin', 'editor', 'content_editor'].includes(role))
        return <p>Tu rol no permite editar el portal.</p>;
    return <>
    <header className={moduleClass("editor-heading")}><div><p className={moduleClass("editor-eyebrow")}>PORTAL INSTITUCIONAL</p><h1>Editar portal web</h1><p>Actualiza el contenido de la página pública de tu institución. Publica los cambios para que los vea la comunidad.</p></div>
      <span className={moduleClass(`editor-status ${dirty ? 'is-unsaved' : ''}`)}><span aria-hidden="true"/>{dirty ? 'Cambios sin guardar' : selected?.status === 'published' ? 'Página publicada' : 'Borrador'}</span>
    </header>
    <div className={moduleClass("editor-pagebar")}>
      <label>Página que estás editando<select disabled={disabled} value={selected?.page_id ?? ''} onChange={event => select(pages.find(page => page.page_id === event.target.value) ?? null)}><option value="">Nueva página</option>{pages.map(page => <option key={page.page_id} value={page.page_id}>{page.snapshot.title} · {page.status === 'published' ? 'Publicada' : 'Borrador'}</option>)}</select></label>
      <button type="button" disabled={busy || uploading || loading} onClick={refresh}><RefreshCw size={16} aria-hidden="true"/>Recargar</button>
      <button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye size={16} aria-hidden="true"/>{preview ? 'Ocultar vista previa' : 'Ver vista previa'}</button>
      {selected?.status === 'published' && selected.published_slug && <a className={moduleClass("editor-public-link")} href={`/?institution=${encodeURIComponent(slug)}&slug=${encodeURIComponent(selected.published_slug)}`} target="_blank" rel="noreferrer">Abrir portal<ExternalLink size={15} aria-hidden="true"/></a>}
    </div>
    {error && <p role="alert" className={moduleClass("editor-error")}>{error}</p>}{message && <p role="status" className={moduleClass("editor-success")}><Check size={18} aria-hidden="true"/>{message}</p>}
    {loading && <p role="status" className={moduleClass("editor-loading")}>Cargando páginas e identidad institucional…</p>}
    {preview && <button type="button" className={moduleClass('editor-preview-expand')} aria-pressed={widePreview} onClick={() => setWidePreview(value => !value)}>{widePreview ? 'Volver a la vista dividida' : 'Ampliar vista previa'}</button>}
    <div className={moduleClass(`editor-layout ${preview ? 'with-preview' : ''} ${preview && widePreview ? 'preview-expanded' : ''}`)}>
      <form className={moduleClass("editor-form")} onSubmit={event => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={disabled || (!selected && !configuration)}>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>01</span><div><h2>Identidad y página</h2><p>El nombre y el logotipo que reconocerá tu comunidad.</p></div></div>
            <div className={moduleClass("editor-grid")}>
              <label>Título de la página<input required maxLength={255} placeholder="Por ejemplo: Inicio" value={snapshot.title} onChange={event => edit({ ...snapshot, title: event.target.value })}/></label>
              <label>Dirección de la página<input readOnly={Boolean(selected?.published_slug)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="inicio" value={snapshot.slug} onChange={event => edit({ ...snapshot, slug: event.target.value })}/><span className={moduleClass("editor-hint")}>Minúsculas, números y guiones.</span></label>
              <label className={moduleClass("editor-wide")}>Nombre del portal<input required maxLength={255} value={snapshot.settings.site_title} onChange={event => edit({ ...snapshot, settings: { ...snapshot.settings, site_title: event.target.value } })}/></label>
            </div>
            <div className={moduleClass("editor-grid")}>
              <label>Correo de contacto<input type="email" maxLength={255} value={snapshot.settings.contact_email ?? ''} onChange={event => edit({...snapshot,settings:{...snapshot.settings,contact_email:event.target.value}})} /></label>
              <label>Teléfono de contacto<input type="tel" maxLength={50} value={snapshot.settings.contact_phone ?? ''} onChange={event => edit({...snapshot,settings:{...snapshot.settings,contact_phone:event.target.value}})} /></label>
              {[...new Set(['facebook','instagram','youtube','tiktok',...Object.keys(snapshot.settings.social_links??{})])].map(network=><label key={network}>{network}<input type="url" placeholder="https://?" value={snapshot.settings.social_links?.[network] ?? ''} onChange={event => {const links={...snapshot.settings.social_links};if(event.target.value)links[network]=event.target.value;else delete links[network];edit({...snapshot,settings:{...snapshot.settings,social_links:links}});}} /></label>)}
            </div>
            <PortalImageInput institutionId={institutionId} value={snapshot.settings.logo_url} onChange={logo_url => edit({ ...snapshot, settings: { ...snapshot.settings, logo_url } })} onBusyChange={imageBusy}/>
            <label className={moduleClass("editor-check")}><input type="checkbox" checked={snapshot.is_homepage} onChange={event => edit({ ...snapshot, is_homepage: event.target.checked })}/>Usar esta página como portada institucional</label>
          </section>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>02</span><div><h2>Estilo del portal</h2><p>Una identidad consistente en todas tus páginas.</p></div></div>
            <div className={moduleClass("editor-templates")} role="group" aria-label="Plantilla del portal">{templates.map(template => <button type="button" key={template.id} className={moduleClass(`editor-template template-sample-${template.id}`)} aria-pressed={snapshot.template === template.id} onClick={() => edit({ ...snapshot, template: template.id })}><span className={moduleClass("template-miniature")} aria-hidden="true"><i /><i /><i /></span><strong>{template.name}</strong><small>{template.description}</small></button>)}</div>
            <div className={moduleClass("editor-grid")}><label>Color principal<div className={moduleClass("editor-color")}><input aria-label="Color principal" type="color" value={snapshot.theme.primary_color} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, primary_color: event.target.value } })}/><span>{snapshot.theme.primary_color.toUpperCase()}</span></div></label>
              <label>Color de fondo destacado<div className={moduleClass("editor-color")}><input aria-label="Color de fondo destacado" type="color" value={snapshot.theme.secondary_color} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, secondary_color: event.target.value } })}/><span>{snapshot.theme.secondary_color.toUpperCase()}</span></div></label>
              <label>Tipografía<select value={snapshot.theme.font_family} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, font_family: event.target.value } })}>{[...new Set([...fonts, snapshot.theme.font_family])].map(font => <option key={font} value={font}>{font === 'system-ui' ? 'Fuente del sistema' : font}</option>)}</select></label>
              <label>Pie de página<input placeholder="Información institucional de contacto" value={snapshot.settings.footer_text} onChange={event => edit({ ...snapshot, settings: { ...snapshot.settings, footer_text: event.target.value } })}/></label>
            </div>
          </section>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>03</span><div><h2>Contenido de la página</h2><p>Añade secciones, cambia su orden y elige cuáles mostrar.</p></div></div>
            {!snapshot.sections.length && <div className={moduleClass("editor-empty")}><LayoutTemplate size={32} aria-hidden="true"/><h3>Empieza con una sección</h3><p>Una portada, una presentación o las noticias de tu institución.</p></div>}
            {snapshot.sections.map((section, index) => <section className={moduleClass(`editor-section ${!section.is_visible ? 'is-hidden' : ''}`)} key={section.id}>
              <div className={moduleClass("editor-section-heading")}><h3><span>{String(index + 1).padStart(2, '0')}</span>{sectionTypes[section.type as keyof typeof sectionTypes] ?? section.type}</h3><div className={moduleClass("editor-icon-actions")}><button type="button" aria-label={`Subir sección ${index + 1}`} disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Bajar sección ${index + 1}`} disabled={index === snapshot.sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={16}/></button><button type="button" aria-label={`Eliminar sección ${index + 1}`} onClick={() => { if (window.confirm('¿Quitar esta sección de la página?'))
            edit({ ...snapshot, sections: snapshot.sections.filter(item => item.id !== section.id) }); }}><Trash2 size={16}/></button></div></div>
              <label className={moduleClass("editor-check")}><input type="checkbox" checked={section.is_visible} onChange={event => edit({ ...snapshot, sections: snapshot.sections.map(item => item.id === section.id ? { ...item, is_visible: event.target.checked } : item) })}/>Mostrar esta sección</label>
              <label>Título<input value={textValue(section.properties.title)} onChange={event => updateSection(section.id, 'title', event.target.value)}/></label>
              {connected.has(section.type) ? <p className={moduleClass("editor-hint")}>Esta sección muestra los registros públicos de la institución. Su contenido se gestiona desde el módulo correspondiente.</p> : <>
                <label>Contenido<textarea rows={4} value={textValue(section.properties.body ?? section.properties.subtitle ?? section.properties.text ?? section.properties.content)} onChange={event => updateSection(section.id, 'body', event.target.value)}/></label>
                {['banner', 'gallery', 'text'].includes(section.type) && <><PortalImageInput institutionId={institutionId} value={textValue(section.properties.image_url)} onChange={url => updateSection(section.id, 'image_url', url)} onBusyChange={imageBusy} label="Imagen de la sección"/><label>Descripción de la imagen<input required={Boolean(section.properties.image_url)} placeholder="Describe la imagen para quien no pueda verla" value={textValue(section.properties.alt)} onChange={event => updateSection(section.id, 'alt', event.target.value)}/></label></>}
                {!['transparency', 'simulators'].includes(section.type) && !(section.type==='links' && Array.isArray(section.properties.items)) && <div className={moduleClass("editor-grid")}><label>Enlace opcional<input placeholder="https://… o /ruta" value={textValue(section.properties.url ?? section.properties.button_url)} onChange={event => updateSection(section.id, 'url', event.target.value)}/></label><label>Texto del enlace<input value={textValue(section.properties.link_label ?? section.properties.button_label)} onChange={event => updateSection(section.id, 'link_label', event.target.value)}/></label></div>}
              </>}
              {['news','events','honors'].includes(section.type) && <a href={'/panel/publicaciones/'+({news:'noticias',events:'eventos',honors:'cuadro-de-honor'}[section.type as 'news'|'events'|'honors'])+'?institution='+encodeURIComponent(institutionId)} target="_blank" rel="noreferrer">Editar los registros de esta sección<ExternalLink size={15} aria-hidden="true" /></a>}
              <SectionDetails section={section} onChange={properties => edit({...snapshot,sections:snapshot.sections.map(item=>item.id===section.id?{...item,properties}:item)})} />
            </section>)}
            <label className={moduleClass("editor-add-section")}>Añadir sección<select disabled={!catalog.length || snapshot.sections.length >= 40} value="" onChange={event => { const option = catalog.find(item => item.type === event.target.value); if (option)
        edit({ ...snapshot, sections: [...snapshot.sections, { id: crypto.randomUUID(), type: option.type, position: snapshot.sections.length, is_visible: true, properties: structuredClone(option.default_properties) }] }); }}><option value="">Selecciona un tipo de contenido</option>{catalog.map(({ type }) => <option key={type} value={type}>{sectionTypes[type as keyof typeof sectionTypes] ?? type}</option>)}</select></label>
          </section>
          <div className={moduleClass("editor-savebar")}><div><strong>{dirty ? 'Tu diseño tiene cambios pendientes' : 'Todo listo para continuar'}</strong><p>Guardar un borrador no cambia el portal público.</p></div><div className={moduleClass("editor-save-actions")}><button type="submit"><Save size={16} aria-hidden="true"/>{busy ? 'Guardando…' : 'Guardar borrador'}</button>{canPublish && <button type="button" className={moduleClass("editor-primary")} onClick={event => { if (event.currentTarget.form?.reportValidity() && window.confirm('¿Publicar esta página y aplicar su identidad y navegación al portal institucional?'))
        void save(true); }}><Globe2 size={16} aria-hidden="true"/>Publicar página</button>}</div></div>
        </fieldset>
      </form>
      {preview && <aside className={moduleClass("editor-preview")} aria-label="Vista previa del diseño"><div className={moduleClass("editor-preview-toolbar")}><div><Eye size={16} aria-hidden="true"/><strong>Vista previa</strong></div><div role="group" aria-label="Tamaño de vista previa"><button type="button" aria-label="Vista de escritorio" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={18}/><span>Computadora</span></button><button type="button" aria-label="Vista de móvil" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={18}/><span>Celular</span></button></div></div><div className={moduleClass('editor-preview-canvas')}><PortalPreviewFrame device={device}><PortalRenderer snapshot={snapshot} institutionSlug={slug} institutionId={institutionId} preview/></PortalPreviewFrame></div><p className={moduleClass("editor-hint")}>Revisa el borrador antes de publicarlo. Puedes desplazarte dentro de la vista previa; los enlaces están desactivados.</p></aside>}
    </div>
  </>;
}
