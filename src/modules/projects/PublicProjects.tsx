import { useEffect, useState } from 'react';
import { supabase } from '../../core/supabaseClient';
import { getPublicInstitutions } from '../../core/institutionService';
import { sumMoney, remainingMoney } from './projectValidation';

interface Summary { project_id: string; title: string; description: string;  total_budget: number; spent: number; balance: number }
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
export function PublicProjects() {
  const [institutions, setInstitutions] = useState<Array<{ name: string; slug: string }>>([]);
  const [slug, setSlug] = useState(() => new URLSearchParams(location.search).get('institution') ?? '');
  const [state, setState] = useState<{ slug: string; rows: Summary[]; error: string } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await getPublicInstitutions();
        if (active) { setInstitutions(data ?? []); setError(''); }
      } catch { if (active) setError('No se pudo cargar la lista de instituciones. Inténtalo de nuevo.'); }
    })();
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (!slug) return;
    let active = true;
    void (async () => {
      try {
        const institution = await supabase.from('institutions').select('institution_id').eq('slug',slug).eq('is_active',true).maybeSingle();
        if(institution.error)throw institution.error;
        if(!institution.data){if(active)setState({slug,rows:[],error:''});return;}
        const module = await supabase.from('module_settings').select('is_enabled').eq('institution_id',institution.data.institution_id).eq('module_name','projects').maybeSingle();
        if(module.error)throw module.error;
        if(module.data?.is_enabled===false){if(active)setState({slug,rows:[],error:''});return;}
        const {data,error:failure}=await supabase.from('projects').select('project_id,title,description,total_budget,budget_items(expenses(amount))').eq('institution_id',institution.data.institution_id).eq('is_public',true);
        if(failure)throw failure;
        const rows=(data??[]).map(p=>{const spent=sumMoney(p.budget_items.flatMap(b=>b.expenses.map(e=>Number(e.amount))));return {project_id:p.project_id,title:p.title,description:p.description??'',total_budget:Number(p.total_budget),spent,balance:remainingMoney(Number(p.total_budget),spent)};});
        if (active) setState({ slug, rows, error: '' });
      } catch { if (active) setState({ slug, rows: [], error: 'No se pudieron cargar los resúmenes aprobados. Inténtalo de nuevo.' }); }
    })();
    return () => { active = false; };
  }, [slug, revision]);
  const current = state?.slug === slug ? state : null;
  return <div className="mx-auto max-w-6xl p-6">
    <h1 className="text-2xl font-bold">Transparencia de proyectos</h1>
    {current && !current.error && current.rows.length > 0 && <button className="my-3 rounded border px-4 py-2 print:hidden" onClick={() => window.print()}>Imprimir / guardar informe público PDF</button>}
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
      <p className="text-sm text-teal-700">Resumen aprobado</p>
      <h2 className="my-2 text-xl font-semibold">{row.title}</h2><p>{row.description}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt>Asignado</dt><dd className="font-bold">{money(row.total_budget)}</dd></div><div><dt>Ejecutado</dt><dd className="font-bold">{money(row.spent)}</dd></div><div><dt>Saldo</dt><dd className="font-bold">{money(row.balance)}</dd></div></dl>
    </article>)}</div>
  </div>;
}
