import { SectionDetails } from './SectionDetails';
import { PrivateContentSkeleton } from '../site/components/Layout/PrivateContentSkeleton';
import {moduleClass} from './portalStyles';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpRight, ExternalLink, FileText, Palette, Eye, Globe2, LayoutTemplate, Monitor, RefreshCw, Save, Smartphone, Trash2 } from 'lucide-react';
import { useTenant } from '../../core/TenantContext';
import { listPortalPages, loadPortalConfiguration, loadPublicRecordCounts, loadSectionCatalog, savePortal, type PortalDraft, type PortalSectionOption, type PublicRecordCounts } from './portalService';
import { projectError } from '../projects/projectService';
import { newSnapshot, sectionTypes, slugify, textValue, withCurrentIdentity, type PortalSnapshot } from './contract';
import { LinkDestination, portalDestinations } from './LinkDestination';
import { confirmAction } from '../../shared/components/ConfirmDialog/confirm';
import { PortalRenderer } from './PortalRenderer';
import { PortalImageInput } from './PortalImageInput';
import { PortalPreviewFrame } from './PortalPreviewFrame';
import { conflictingPortalPage, initialPortalPage, portalDuplicateMessage } from './portalSelection';
import { notify, notifyInvalidForm } from '../../shared/components/Toaster/notify';
const templates = [
    { id: 'classic', name: 'Institucional', description: 'Portada amplia y lectura ordenada.' },
    { id: 'cards', name: 'Tarjetas', description: 'Bloques visuales en una cuadrícula.' },
    { id: 'editorial', name: 'Editorial', description: 'Contenido centrado y lectura cómoda.' },
] as const;
const fonts = ['Arial', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'system-ui'];
const connected = new Set(['news', 'events', 'staff', 'honors']);
const socialNetworks: Record<string, { label: string; example: string }> = {
    facebook: { label: 'Facebook', example: 'https://www.facebook.com/tu-institucion' },
    instagram: { label: 'Instagram', example: 'https://www.instagram.com/tu-institucion' },
    youtube: { label: 'YouTube', example: 'https://www.youtube.com/@tu-institucion' },
    tiktok: { label: 'TikTok', example: 'https://www.tiktok.com/@tu-institucion' },
};
// Sections owned by other modules: shown as published, not editable or savable here.
const moduleSections: Record<string, string> = { dece_info: 'Información del DECE' };
// Records of these sections are managed in Publicaciones (same tab, so the session is already loaded).
const publicationPages: Record<string, { label: string; path: string }> = {
    news: { label: 'Noticias', path: '/panel/publicaciones/noticias' },
    events: { label: 'Eventos', path: '/panel/publicaciones/eventos' },
    honors: { label: 'Cuadro de honor', path: '/panel/publicaciones/cuadro-de-honor' },
};
const guide = [
    ['Elige qué editar', 'Una página del portal o la identidad, que es común a todas.'],
    ['Edita su contenido', 'Cambia textos, imágenes, botones y secciones.'],
    ['Revisa la vista previa', 'Comprueba cómo se verá en computadora y celular.'],
    ['Guarda o publica', 'El borrador es privado; publicar lo muestra a todos.'],
] as const;
export function PortalEditor() {
    const { activeInstitution, institutions, setActiveInstitution } = useTenant();
    const [saving, setSaving] = useState(false);
    const [unsaved, setUnsaved] = useState(false);
    if (!activeInstitution)
        return <p>Selecciona una institución.</p>;
    return <div className={moduleClass("portal-editor")}>
    <div className={moduleClass("editor-institution")}><Globe2 size={18} aria-hidden="true"/><label>Institución
      <select disabled={saving} value={activeInstitution.institution_id} onChange={async event => {
            const next = institutions.find(item => item.institution_id === event.target.value) ?? null;
            if (unsaved && !await confirmAction({ title: '¿Cambiar de institución?', message: 'Tienes cambios sin guardar en esta página. Si continúas, se descartarán.', confirmLabel: 'Descartar y cambiar', tone: 'danger' }))
                return;
            setUnsaved(false);
            setActiveInstitution(next);
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
    const [recordCounts, setRecordCounts] = useState<PublicRecordCounts | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);
    const [slugTouched, setSlugTouched] = useState(false);
    // Identity (header, footer, colors) is shared by every page, so it is edited in its own view.
    const [view, setView] = useState<'pages' | 'identity'>('pages');
    const navigate = useNavigate();
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
            if (failure?.status === 'rejected') {
                const message = projectError(failure.reason);
                setError(message);
                notify.error('No se pudo cargar el editor', { id: 'portal-load', description: message });
            }
            setLoading(false);
        })();
        return () => { active = false; };
    }, [institutionId, name, reload]);
    useEffect(() => {
        // Counts only bound the "how many to show" choices; a failure leaves the default maximum.
        let active = true;
        loadPublicRecordCounts(institutionId).then(counts => { if (active) setRecordCounts(counts); }, () => { if (active) setRecordCounts({}); });
        return () => { active = false; };
    }, [institutionId, reload]);
    useEffect(() => {
        const warn = (event: Event) => { if (dirtyRef.current)
            event.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        window.addEventListener('portal-editor-before-leave', warn);
        return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('portal-editor-before-leave', warn); };
    }, []);
    function markDirty(value: boolean) { dirtyRef.current = value; setDirty(value); onDirtyChange(value); }
    function edit(next: PortalSnapshot) { setSnapshot(next); markDirty(true); }
    const discardOptions = { title: '¿Descartar los cambios?', message: 'Tienes cambios sin guardar en esta página. Si continúas, se perderán.', confirmLabel: 'Descartar cambios', tone: 'danger' } as const;
    async function select(page: PortalDraft | null) {
        if (dirty && !await confirmAction(discardOptions))
            return;
        setSlugTouched(false);
        setSelected(page);
        selectedId.current = page?.page_id ?? null;
        setSnapshot(structuredClone(page?.snapshot ?? configuration ?? newSnapshot(name)));
        markDirty(false);
        setError('');
    }
    async function refresh() {
        if (dirty && !await confirmAction({ ...discardOptions, confirmLabel: 'Descartar y recargar' }))
            return;
        setSelected(null);
        markDirty(false);
        setError('');
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
        const blank = !snapshot.settings.site_title.trim() ? 'El nombre del portal' : !snapshot.title.trim() ? 'El título de la página' : '';
        if (blank) {
            setError(`${blank} no puede quedar vacío ni tener solo espacios.`);
            notify.warning('Revisa el formulario', { description: `${blank} no puede quedar vacío ni tener solo espacios.` });
            return;
        }
        const managed = snapshot.sections.find(section => !Object.hasOwn(sectionTypes, section.type));
        if (managed) {
            const name = moduleSections[managed.type] ?? managed.type;
            setError(`Esta página incluye «${name}», que se administra desde su propio módulo y todavía no se puede guardar desde el editor. Los visitantes siguen viendo la versión publicada.`);
            notify.warning('Esta página no se puede guardar aquí', { description: `Incluye «${name}», que se administra desde su propio módulo.` });
            return;
        }
        const duplicate = conflictingPortalPage(pages, selected?.page_id ?? null, snapshot.slug);
        if (duplicate) {
            setError(`La dirección «${snapshot.slug}» ya pertenece a «${duplicate.snapshot.title}». Selecciona esa página para editarla o usa otra dirección para una página nueva. Tus cambios siguen en el formulario.`);
            notify.warning('Dirección en uso', { description: `«${snapshot.slug}» ya pertenece a «${duplicate.snapshot.title}». Tus cambios siguen en el formulario.` });
            return;
        }
        inFlight.current = true;
        setBusy(true);
        onBusyChange(true);
        setError('');
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
            if (publish) notify.success('Cambios publicados', { description: 'Ya están disponibles para los visitantes del portal institucional.' });
            else notify.success('Borrador guardado', { description: 'Tu portal público conserva su versión anterior.' });
        }
        catch (cause) {
            const message = portalDuplicateMessage(cause) ?? projectError(cause);
            setError(message);
            notify.error(publish ? 'No se publicaron los cambios' : 'No se guardó el borrador', { description: message });
        }
        finally {
            inFlight.current = false;
            setBusy(false);
            onBusyChange(false);
        }
    }
    async function publish(form: HTMLFormElement | null) {
        if (!form?.reportValidity()) return;
        const page = snapshot.title || 'esta página';
        const accepted = await confirmAction(view === 'identity' ? {
            title: '¿Publicar la identidad del portal?',
            message: `El nombre, el logotipo, el contacto, los colores y el pie de página se aplicarán a todas las páginas. Se publica junto con «${page}», la página seleccionada.`,
            confirmLabel: 'Publicar identidad',
        } : {
            title: `¿Publicar «${page}»?`,
            message: 'Los visitantes verán los cambios de inmediato. El encabezado y el pie de página siguen siendo los mismos en todo el portal.',
            confirmLabel: 'Publicar ahora',
        });
        if (accepted) void save(true);
    }
    async function openPublications(type: string) {
        const target = publicationPages[type];
        if (dirty && !await confirmAction({ title: `¿Ir a ${target.label}?`, message: 'Tienes cambios sin guardar en el portal. Si sales ahora, se perderán. Guarda un borrador antes si quieres conservarlos.', confirmLabel: 'Salir sin guardar', cancelLabel: 'Seguir editando', tone: 'danger' }))
            return;
        markDirty(false);
        navigate(target.path);
    }
    async function removeSection(id: string, title: string) {
        if (await confirmAction({ title: `¿Quitar la sección «${title}»?`, message: 'Desaparecerá de esta página cuando guardes o publiques. Puedes volver a añadirla después.', confirmLabel: 'Quitar sección', tone: 'danger' }))
            edit({ ...snapshot, sections: snapshot.sections.filter(item => item.id !== id) });
    }
    // Only published pages can be reached by visitors, so drafts are not offered as destinations.
    const destinations = portalDestinations(pages.filter(page => page.status === 'published').map(page => ({ title: page.snapshot.title, slug: page.published_slug ?? page.snapshot.slug })));
    const autoSlug = !selected && !slugTouched;
    const sectionName = (type: string) => sectionTypes[type as keyof typeof sectionTypes] ?? type;
    if (!['super_admin', 'institution_admin', 'editor', 'content_editor'].includes(role))
        return <p>Tu rol no permite editar el portal.</p>;
    return <>
    <header className={moduleClass("editor-heading")}><div><p className={moduleClass("editor-eyebrow")}>PORTAL INSTITUCIONAL</p><h1>Editar portal web</h1><p>Actualiza el contenido de la página pública de tu institución. Publica los cambios para que los vea la comunidad.</p></div>
      <span className={moduleClass(`editor-status ${dirty ? 'is-unsaved' : ''}`)}><span aria-hidden="true"/>{dirty ? 'Cambios sin guardar' : selected?.status === 'published' ? 'Página publicada' : 'Borrador'}</span>
    </header>
    <ol className={moduleClass("editor-guide")} aria-label="Cómo editar el portal">{guide.map(([title, text], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
    <div className={moduleClass("editor-tabs")} role="tablist" aria-label="Qué quieres editar">
      <button type="button" role="tab" aria-selected={view === 'pages'} onClick={() => setView('pages')}><FileText size={18} aria-hidden="true"/><span><strong>Páginas</strong><small>Contenido de cada página del portal</small></span></button>
      <button type="button" role="tab" aria-selected={view === 'identity'} onClick={() => setView('identity')}><Palette size={18} aria-hidden="true"/><span><strong>Identidad del portal</strong><small>Encabezado, pie y colores: iguales en todas las páginas</small></span></button>
    </div>
    <div className={moduleClass("editor-pagebar")}>
      {view === 'pages' ? <label>Página que estás editando<select disabled={disabled} value={selected?.page_id ?? ''} onChange={event => void select(pages.find(page => page.page_id === event.target.value) ?? null)}>{pages.map(page => <option key={page.page_id} value={page.page_id}>{page.snapshot.title} · {page.status === 'published' ? 'Publicada' : 'Borrador'}</option>)}<option value="">+ Crear otra página</option></select></label>
        : <p className={moduleClass("editor-identity-note")}><Palette size={18} aria-hidden="true"/>Estos datos forman el encabezado y el pie de página de <strong>todas</strong> las páginas. Se editan una sola vez aquí.</p>}
      <button type="button" disabled={busy || uploading || loading} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>Recargar</button>
      <button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye size={16} aria-hidden="true"/>{preview ? 'Ocultar vista previa' : 'Ver vista previa'}</button>
      {selected?.status === 'published' && selected.published_slug && <a className={moduleClass("editor-public-link")} href={`/?institution=${encodeURIComponent(slug)}&slug=${encodeURIComponent(selected.published_slug)}`} target="_blank" rel="noreferrer">Abrir portal<ExternalLink size={15} aria-hidden="true"/></a>}
    </div>
    {error && <p role="alert" className={moduleClass("editor-error")}>{error}</p>}
    {loading && <PrivateContentSkeleton label="Cargando páginas e identidad institucional" />}
    {preview && <button type="button" className={moduleClass('editor-preview-expand')} aria-pressed={widePreview} onClick={() => setWidePreview(value => !value)}>{widePreview ? 'Volver a la vista dividida' : 'Ampliar vista previa'}</button>}
    <div className={moduleClass(`editor-layout ${preview ? 'with-preview' : ''} ${preview && widePreview ? 'preview-expanded' : ''}`)}>
      <form className={moduleClass("editor-form")} onInvalidCapture={notifyInvalidForm} onSubmit={event => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={disabled || (!selected && !configuration)}>
          {view === 'identity' ? <>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>01</span><div><h2>Nombre y logotipo</h2><p>Lo que tu comunidad reconoce en el encabezado de cada página.</p></div></div>
            <div className={moduleClass("editor-grid")}>
              <label className={moduleClass("editor-wide")}>Nombre del portal<input required maxLength={255} value={snapshot.settings.site_title} onChange={event => edit({ ...snapshot, settings: { ...snapshot.settings, site_title: event.target.value } })}/><span className={moduleClass("editor-hint")}>Aparece junto al logotipo en todas las páginas.</span></label>
            </div>
            <PortalImageInput institutionId={institutionId} value={snapshot.settings.logo_url} onChange={logo_url => edit({ ...snapshot, settings: { ...snapshot.settings, logo_url } })} onBusyChange={imageBusy}/>
          </section>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>02</span><div><h2>Contacto y redes sociales</h2><p>Se muestran en el pie de página de todo el portal.</p></div></div>
            <div className={moduleClass("editor-grid")}>
              <label>Correo de contacto<input type="email" maxLength={255} value={snapshot.settings.contact_email ?? ''} onChange={event => edit({...snapshot,settings:{...snapshot.settings,contact_email:event.target.value}})} /></label>
              <label>Teléfono de contacto<input type="tel" maxLength={50} value={snapshot.settings.contact_phone ?? ''} onChange={event => edit({...snapshot,settings:{...snapshot.settings,contact_phone:event.target.value}})} /></label>
              {[...new Set(['facebook','instagram','youtube','tiktok',...Object.keys(snapshot.settings.social_links??{})])].map(network=><label key={network}>{socialNetworks[network]?.label ?? network} (opcional)<input type="url" maxLength={2048} placeholder={socialNetworks[network]?.example ?? 'https://'} value={snapshot.settings.social_links?.[network] ?? ''} onChange={event => {const links={...snapshot.settings.social_links};if(event.target.value)links[network]=event.target.value;else delete links[network];edit({...snapshot,settings:{...snapshot.settings,social_links:links}});}} /></label>)}
            </div>
          </section>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>03</span><div><h2>Estilo del portal</h2><p>Una identidad consistente en todas tus páginas.</p></div></div>
            <div className={moduleClass("editor-templates")} role="group" aria-label="Plantilla del portal">{templates.map(template => <button type="button" key={template.id} className={moduleClass(`editor-template template-sample-${template.id}`)} aria-pressed={snapshot.template === template.id} onClick={() => edit({ ...snapshot, template: template.id })}><span className={moduleClass("template-miniature")} aria-hidden="true"><i /><i /><i /></span><strong>{template.name}</strong><small>{template.description}</small></button>)}</div>
            <div className={moduleClass("editor-grid")}><label>Color principal<div className={moduleClass("editor-color")}><input aria-label="Color principal" type="color" value={snapshot.theme.primary_color} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, primary_color: event.target.value } })}/><span>{snapshot.theme.primary_color.toUpperCase()}</span></div></label>
              <label>Color de fondo destacado<div className={moduleClass("editor-color")}><input aria-label="Color de fondo destacado" type="color" value={snapshot.theme.secondary_color} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, secondary_color: event.target.value } })}/><span>{snapshot.theme.secondary_color.toUpperCase()}</span></div></label>
              <label>Tipografía<select value={snapshot.theme.font_family} onChange={event => edit({ ...snapshot, theme: { ...snapshot.theme, font_family: event.target.value } })}>{[...new Set([...fonts, snapshot.theme.font_family])].map(font => <option key={font} value={font}>{font === 'system-ui' ? 'Fuente del sistema' : font}</option>)}</select></label>
              <label>Pie de página<input maxLength={255} placeholder="Información institucional de contacto" value={snapshot.settings.footer_text} onChange={event => edit({ ...snapshot, settings: { ...snapshot.settings, footer_text: event.target.value } })}/></label>
            </div>
          </section>
          </> : <>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>01</span><div><h2>Datos de la página</h2><p>Cómo se llama esta página y en qué dirección se abre.</p></div></div>
            <div className={moduleClass("editor-grid")}>
              <label>Título de la página<input required maxLength={255} placeholder="Por ejemplo: Oferta educativa" value={snapshot.title} onChange={event => edit({ ...snapshot, title: event.target.value, slug: autoSlug ? slugify(event.target.value) : snapshot.slug })}/><span className={moduleClass("editor-hint")}>Es el nombre que verán los visitantes.</span></label>
              <label>Dirección de la página<input readOnly={Boolean(selected?.published_slug)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Usa solo letras minúsculas sin tildes, números y guiones. Ejemplo: oferta-educativa" maxLength={100} placeholder="oferta-educativa" value={snapshot.slug} onChange={event => { setSlugTouched(true); edit({ ...snapshot, slug: slugify(event.target.value) || event.target.value.toLowerCase() }); }}/>
                <span className={moduleClass("editor-hint")}>{selected?.published_slug ? 'Esta página ya está publicada; su dirección no cambia para no romper los enlaces existentes.' : autoSlug ? 'Se completa sola a partir del título. Puedes cambiarla si lo necesitas.' : 'Solo minúsculas sin tildes, números y guiones.'}</span></label>
            </div>
            <label className={moduleClass("editor-check")}><input type="checkbox" checked={snapshot.is_homepage} onChange={event => edit({ ...snapshot, is_homepage: event.target.checked })}/>Usar esta página como portada institucional</label>
          </section>
          <section className={moduleClass("editor-card")}><div className={moduleClass("editor-card-heading")}><span>02</span><div><h2>Contenido de la página</h2><p>Lo que se ve entre el encabezado y el pie de página. Cambia textos, imágenes, el orden y qué secciones se muestran.</p></div></div>
            {!snapshot.sections.length && <div className={moduleClass("editor-empty")}><LayoutTemplate size={32} aria-hidden="true"/><h3>Empieza con una sección</h3><p>Una portada, una presentación o las noticias de tu institución.</p></div>}
            {snapshot.sections.map((section, index) => !Object.hasOwn(sectionTypes, section.type) ? <section className={moduleClass("editor-section is-managed")} key={section.id}>
              <div className={moduleClass("editor-section-heading")}><h3><span>{String(index + 1).padStart(2, '0')}</span>{moduleSections[section.type] ?? section.type}</h3></div>
              <p className={moduleClass("editor-hint")}>Este contenido se administra desde su propio módulo y se muestra tal como está publicado. No se puede modificar desde el editor.</p>
            </section> : <section className={moduleClass(`editor-section ${!section.is_visible ? 'is-hidden' : ''}`)} key={section.id}>
              <div className={moduleClass("editor-section-heading")}><h3><span>{String(index + 1).padStart(2, '0')}</span>{sectionTypes[section.type as keyof typeof sectionTypes] ?? section.type}</h3><div className={moduleClass("editor-icon-actions")}><button type="button" aria-label={`Subir sección ${index + 1}`} disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Bajar sección ${index + 1}`} disabled={index === snapshot.sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={16}/></button><button type="button" aria-label={`Eliminar sección ${index + 1}`} onClick={() => void removeSection(section.id, textValue(section.properties.title) || sectionName(section.type))}><Trash2 size={16}/></button></div></div>
              {connected.has(section.type)
                ? <><details className={moduleClass("editor-block")} open><summary>Contenido<small>Título de la sección</small></summary><div className={moduleClass("editor-block-body")}><label>Título<input maxLength={120} value={textValue(section.properties.title)} onChange={event => updateSection(section.id, 'title', event.target.value)}/></label><p className={moduleClass("editor-hint")}>Esta sección muestra los registros públicos de la institución. Su contenido se gestiona desde el módulo correspondiente.</p></div></details></>
                : <><details className={moduleClass("editor-block")} open><summary>Contenido<small>Título y texto</small></summary><div className={moduleClass("editor-block-body")}><label>Título<input maxLength={120} value={textValue(section.properties.title)} onChange={event => updateSection(section.id, 'title', event.target.value)}/></label><label>Contenido<textarea rows={4} maxLength={1500} value={textValue(section.properties.body ?? section.properties.subtitle ?? section.properties.text ?? section.properties.content)} onChange={event => updateSection(section.id, 'body', event.target.value)}/><span className={moduleClass("editor-hint")} aria-live="off">{textValue(section.properties.body ?? section.properties.subtitle ?? section.properties.text ?? section.properties.content).length}/1500</span></label></div></details>
                {['banner', 'gallery', 'text'].includes(section.type) && <details className={moduleClass("editor-block")}><summary>Imágenes<small>Imagen de la sección y su descripción</small></summary><div className={moduleClass("editor-block-body")}><PortalImageInput institutionId={institutionId} value={textValue(section.properties.image_url)} onChange={url => updateSection(section.id, 'image_url', url)} onBusyChange={imageBusy} label="Imagen de la sección"/><label>Descripción de la imagen<input required={Boolean(section.properties.image_url)} maxLength={200} placeholder="Describe la imagen para quien no pueda verla" value={textValue(section.properties.alt)} onChange={event => updateSection(section.id, 'alt', event.target.value)}/></label></div></details>}
                {!['transparency', 'simulators', 'banner'].includes(section.type) && !(section.type==='links' && Array.isArray(section.properties.items)) && <details className={moduleClass("editor-block")}><summary>Enlaces y botones<small>A dónde lleva la sección</small></summary><div className={moduleClass("editor-block-body")}><div className={moduleClass("editor-link-group")}><label>Texto del botón o enlace (opcional)<input maxLength={40} placeholder="Por ejemplo: Conoce más" value={textValue(section.properties.link_label ?? section.properties.button_label)} onChange={event => updateSection(section.id, 'link_label', event.target.value)}/></label>
                  <LinkDestination label="¿A dónde lleva el botón?" value={textValue(section.properties.url ?? section.properties.button_url)} onChange={url => updateSection(section.id, 'url', url)} destinations={destinations}/></div></div></details>}</>}
              {section.type in publicationPages && <button type="button" className={moduleClass("editor-manage-link")} onClick={() => void openPublications(section.type)}><ArrowUpRight size={15} aria-hidden="true" />Ir a {publicationPages[section.type].label} para agregar o editar</button>}
              <details className={moduleClass("editor-block")}><summary>Detalles y elementos<small>Opciones, listas e imágenes por elemento</small></summary><div className={moduleClass("editor-block-body")}><SectionDetails section={section} institutionId={institutionId} onBusyChange={imageBusy} destinations={destinations} recordCounts={recordCounts} onChange={properties => edit({...snapshot,sections:snapshot.sections.map(item=>item.id===section.id?{...item,properties}:item)})} /></div></details>
              <details className={moduleClass("editor-block")} open><summary>Visibilidad<small>Si se muestra en el portal</small></summary><div className={moduleClass("editor-block-body")}><label className={moduleClass("editor-check")}><input type="checkbox" checked={section.is_visible} onChange={event => edit({ ...snapshot, sections: snapshot.sections.map(item => item.id === section.id ? { ...item, is_visible: event.target.checked } : item) })}/>Mostrar esta sección</label></div></details>
            </section>)}
            <label className={moduleClass("editor-add-section")}>Añadir sección<select disabled={!catalog.length || snapshot.sections.length >= 40} value="" onChange={event => { const option = catalog.find(item => item.type === event.target.value); if (option)
        edit({ ...snapshot, sections: [...snapshot.sections, { id: crypto.randomUUID(), type: option.type, position: snapshot.sections.length, is_visible: true, properties: structuredClone(option.default_properties) }] }); }}><option value="">Selecciona un tipo de contenido</option>{catalog.map(({ type }) => <option key={type} value={type}>{sectionTypes[type as keyof typeof sectionTypes] ?? type}</option>)}</select></label>
          </section>
          </>}
          <div className={moduleClass("editor-savebar")}><div><strong>{dirty ? 'Tienes cambios sin guardar' : 'Todo listo para continuar'}</strong><p>{view === 'identity' ? `La identidad se publica junto con «${snapshot.title || 'la página seleccionada'}». Guardar un borrador no cambia el portal público.` : 'Guardar un borrador no cambia el portal público.'}</p></div><div className={moduleClass("editor-save-actions")}><button type="submit"><Save size={16} aria-hidden="true"/>{busy ? 'Guardando…' : 'Guardar borrador'}</button>{canPublish && <button type="button" className={moduleClass("editor-primary")} onClick={event => void publish(event.currentTarget.form)}><Globe2 size={16} aria-hidden="true"/>{view === 'identity' ? 'Publicar identidad' : 'Publicar página'}</button>}</div></div>
        </fieldset>
      </form>
      {preview && <aside className={moduleClass("editor-preview")} aria-label="Vista previa del diseño"><div className={moduleClass("editor-preview-toolbar")}><div><Eye size={16} aria-hidden="true"/><strong>Vista previa</strong></div><div role="group" aria-label="Tamaño de vista previa"><button type="button" aria-label="Vista de escritorio" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={18}/><span>Computadora</span></button><button type="button" aria-label="Vista de móvil" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={18}/><span>Celular</span></button></div></div><div className={moduleClass('editor-preview-canvas')}><PortalPreviewFrame device={device}><PortalRenderer snapshot={snapshot} institutionSlug={slug} institutionId={institutionId} preview/></PortalPreviewFrame></div><p className={moduleClass("editor-hint")}>Revisa el borrador antes de publicarlo. Puedes desplazarte dentro de la vista previa; los enlaces están desactivados.</p></aside>}
    </div>
  </>;
}
