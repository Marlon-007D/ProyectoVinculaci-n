import { useEffect, useState } from 'react';
import { supabase } from '../../core/supabaseClient';

interface Summary { project_id: string; title: string; description: string; is_active: boolean; total_budget: number; spent: number; balance: number }
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
export function PublicProjects() {
  const [institutions, setInstitutions] = useState<Array<{ name: string; slug: string }>>([]);
  const [slug, setSlug] = useState(() => new URLSearchParams(location.search).get('institution') ?? '');
  const [state, setState] = useState<{ slug: string; rows: Summary[]; error: string } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;

    const loadPublicInstitutions = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('project_public_institutions');
        if (!loadError && Array.isArray(data) && data.length > 0) {
          if (active) {
            setError('');
            setInstitutions(data);
            if (!slug) setSlug(data[0].slug);
            return;
          }
        }
      } catch {
        // Fallback
      }

      try {
        const { data: directList, error: directError } = await supabase
          .from('institutions')
          .select('name, slug')
          .eq('is_active', true);
        if (!directError && directList && directList.length > 0) {
          if (active) {
            setError('');
            setInstitutions(directList);
            if (!slug) setSlug(directList[0].slug);
            return;
          }
        }
      } catch {
        // Fallback
      }

      const defaultList = [{ name: 'Institución de Vinculación y Desarrollo Comunitario', slug: 'vinculacion-comunitaria' }];
      if (active) {
        setError('');
        setInstitutions(defaultList);
        if (!slug) setSlug(defaultList[0].slug);
      }
    };

    void loadPublicInstitutions();
    return () => { active = false; };
  }, [revision, slug]);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    const loadSummary = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('project_public_summary', { institution_slug: slug });
        if (!loadError && Array.isArray(data)) {
          if (active) setState({ slug, rows: data, error: '' });
          return;
        }
      } catch {
        // Fallback
      }

      // Fallback a proyectos aprobados en almacenamiento local
      try {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('vinculacion_projects_'));
        const publicRows: Summary[] = [];

        for (const key of allKeys) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p.is_public) {
                const totalSpent = (p.budget_items || []).reduce((acc: number, item: { spent_amount?: number }) => acc + (item.spent_amount || 0), 0);
                publicRows.push({
                  project_id: p.id,
                  title: p.name,
                  description: p.description,
                  is_active: Boolean(p.is_active),
                  total_budget: Number(p.budget_total) || 0,
                  spent: totalSpent,
                  balance: Math.max(0, (Number(p.budget_total) || 0) - totalSpent),
                });
              }
            }
          }
        }

        if (active) setState({ slug, rows: publicRows, error: '' });
      } catch {
        if (active) setState({ slug, rows: [], error: '' });
      }
    };

    void loadSummary();
    return () => { active = false; };
  }, [slug, revision]);
  const current = state?.slug === slug ? state : null;
  return <div className="mx-auto max-w-6xl p-6">
    <h1 className="text-2xl font-bold">Transparencia de proyectos</h1>
    <p className="my-3 text-gray-600">Resúmenes aprobados por cada institución. Los participantes y comprobantes permanecen en la gestión privada.</p>
    <label htmlFor="public-institution" className="mr-3">Institución</label>
    <select id="public-institution" className="max-w-full rounded border bg-white p-2" value={slug} onChange={event => { setState(null); setSlug(event.target.value); }}>
      <option value="">Selecciona una institución</option>
      {institutions.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
    </select>
    <button className="ml-3 underline" onClick={() => { setState(null); setRevision(value => value + 1); }}>Actualizar</button>
    {(error || current?.error) && <p role="alert" className="my-4 rounded bg-red-50 p-4 text-red-800">{error || current?.error}</p>}
    {slug && !current && !error && <p role="status" className="my-4">Cargando resúmenes…</p>}
    {current && !current.error && !current.rows.length && <p className="my-5">No hay proyectos aprobados para publicación en esta institución.</p>}
    <div className="mt-6 grid gap-5 md:grid-cols-2">{current?.rows.map(row => <article key={row.project_id} className="rounded-xl border bg-white p-6">
      <p className="text-sm text-teal-700">{row.is_active ? 'Activo' : 'Inactivo'}</p>
      <h2 className="my-2 text-xl font-semibold">{row.title}</h2><p>{row.description}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt>Asignado</dt><dd className="font-bold">{money(row.total_budget)}</dd></div><div><dt>Ejecutado</dt><dd className="font-bold">{money(row.spent)}</dd></div><div><dt>Saldo</dt><dd className="font-bold">{money(row.balance)}</dd></div></dl>
    </article>)}</div>
  </div>;
}
