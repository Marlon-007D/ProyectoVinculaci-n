import {moduleClass} from './portalStyles';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadPublishedPortal } from './portalService';
import type { PortalSnapshot } from './contract';
import { PortalRenderer } from './PortalRenderer';
interface Published {
    snapshot: PortalSnapshot;
    slug: string;
    news: Array<{
        title: string;
        body?: string;
    }>;
    staff: Array<{
        title: string;
        body?: string;
    }>;
    events: Array<{
        title: string;
        body?: string;
    }>;
    honors: Array<{
        title: string;
        body?: string;
    }>;
}
export function PublishedPortal() {
    const [params] = useSearchParams();
    const institution = params.get('institution') ?? '';
    const slug = params.get('page');
    const [state, setState] = useState<{
        key: string;
        data: Published | null;
        error: string;
    } | null>(null);
    const [retry, setRetry] = useState(0);
    const key = `${institution}:${slug}:${retry}`;
    useEffect(() => {
        let active = true;
        void (async () => {
            try {
                const data = await loadPublishedPortal(institution, slug);
                if (active)
                    setState({ key, data, error: '' });
            }
            catch {
                if (active)
                    setState({ key, data: null, error: 'No se pudo cargar el portal. Comprueba la conexión y vuelve a intentarlo.' });
            }
        })();
        return () => { active = false; };
    }, [institution, slug, key]);
    useEffect(() => {
        const previous = document.title;
        if (state?.key === key && state.data)
            document.title = `${state.data.snapshot.title} | ${state.data.snapshot.settings.site_title}`;
        return () => { document.title = previous; };
    }, [state, key]);
    if (!institution)
        return <div className={moduleClass("portal-feedback")}><p>PORTAL INSTITUCIONAL</p><h1>Encuentra tu institución</h1><p>Accede con el enlace público proporcionado por tu institución.</p></div>;
    if (state?.key !== key)
        return <div className={moduleClass("portal-feedback")} role="status"><p>PORTAL INSTITUCIONAL</p><h1>Cargando tu portal…</h1></div>;
    if (state.error)
        return <div className={moduleClass("portal-feedback")} role="alert"><h1>No pudimos abrir esta página</h1><p>{state.error}</p><button onClick={() => setRetry(value => value + 1)}>Volver a intentar</button></div>;
    if (!state.data)
        return <div className={moduleClass("portal-feedback")}><p>PORTAL INSTITUCIONAL</p><h1>Contenido aún no disponible</h1><p>La institución todavía no ha publicado esta página.</p></div>;
    return <PortalRenderer snapshot={state.data.snapshot} institutionSlug={state.data.slug} news={state.data.news} staff={state.data.staff} events={state.data.events} honors={state.data.honors}/>;
}
