import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadPublishedPortal } from './portalService';
import type { PortalSnapshot } from './contract';
import { PortalRenderer } from './PortalRenderer';
interface Published { snapshot: PortalSnapshot; slug: string; news: Array<{title: string; body?: string}>; staff: Array<{title: string; body?: string}> }
export function PublishedPortal() {
  const [params] = useSearchParams(); const institution = params.get('institution') ?? ''; const slug = params.get('page');
  const [state, setState] = useState<{ key: string; data: Published | null; error: string } | null>(null);
  const key = `${institution}:${slug}`;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data=await loadPublishedPortal(institution,slug);
        if (active) setState({ key, data, error: '' });
      } catch { if (active) setState({ key, data: null, error: 'No se pudo cargar el portal. Comprueba la conexión y vuelve a intentarlo.' }); }
    })();
    return () => { active = false; };
  }, [institution, slug, key]);
  if (!institution) return <p className="p-8">Abre el enlace público de una institución desde su editor.</p>;
  if (state?.key !== key) return <p role="status" className="p-8">Cargando portal…</p>;
  if (state.error) return <p role="alert" className="p-8">{state.error}</p>;
  if (!state.data) return <p className="p-8">No hay una página publicada disponible.</p>;
  return <PortalRenderer snapshot={state.data.snapshot} institutionSlug={state.data.slug} news={state.data.news} staff={state.data.staff} />;
}
