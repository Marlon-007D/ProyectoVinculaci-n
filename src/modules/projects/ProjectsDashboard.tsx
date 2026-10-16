import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Institution } from '../../core/TenantContext';
import { createProjectService, projectError } from './projectService';
import { ecuadorToday, MAX_STORED_MONEY, projectDateWindow, sumMoney, remainingMoney, validateProjectDates, type ProjectAcademicPeriod } from './projectValidation';
import { ProjectDetails } from './ProjectDetails';
import type { Project } from './types';
export function ProjectsDashboard({ institution }: { institution: Institution }) {
  const service=useMemo(()=>createProjectService(institution.institution_id),[institution.institution_id]);
  const [projects,setProjects]=useState<Project[]>([]);const [selected,setSelected]=useState<Project|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<ProjectAcademicPeriod|null>(null);const [periodError,setPeriodError]=useState('');
  const [startDate,setStartDate]=useState('');const [endDate,setEndDate]=useState('');const [budget,setBudget]=useState('');
  const [search,setSearch]=useState('');const [publication,setPublication]=useState('all');const request=useRef(0);const lock=useRef(false);
  const refresh=useCallback(async()=>{
    const id=++request.current;setLoading(true);setError('');setPeriodError('');
    const [projectResult,periodResult]=await Promise.allSettled([service.getProjects(),service.getAcademicPeriod()]);
    if(id!==request.current)return;
    if(projectResult.status==='fulfilled')setProjects(projectResult.value.data);else{setProjects([]);setError(projectError(projectResult.reason));}
    if(periodResult.status==='fulfilled')setPeriod(periodResult.value);else{setPeriod(null);setPeriodError(projectError(periodResult.reason));}
    setLoading(false);
  },[service]);
  useEffect(()=>{void refresh();return()=>{request.current++;};},[refresh]);
  async function create(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(lock.current)return;const form=event.currentTarget;const data=new FormData(form);lock.current=true;setBusy(true);setError('');
    try{const result=await service.createProject({name:String(data.get('name')),description:String(data.get('description')),budget_total:Number(data.get('budget')),start_date:startDate,end_date:endDate});setProjects(old=>[result.data,...old]);form.reset();setStartDate('');setEndDate('');setBudget('');setSelected(result.data);}catch(e){setError(projectError(e));}finally{lock.current=false;setBusy(false);}
  }
  let bounds:{min:string;max:string}|null=null;let dateError='';
  try{bounds=projectDateWindow(period,ecuadorToday());if(startDate&&endDate)validateProjectDates(startDate,endDate,period??undefined,ecuadorToday());}catch(cause){dateError=projectError(cause);}
  const total=sumMoney(projects.map(p=>p.budget_total));const spent=sumMoney(projects.flatMap(p=>p.budget_items.map(b=>b.spent_amount)));
  if(selected)return <ProjectDetails project={selected} institutionName={institution.name} canPublish={['super_admin','institution_admin'].includes(institution.role)} onBack={()=>{setSelected(null);void refresh();}} onProjectUpdate={p=>{setSelected(p);setProjects(old=>old.map(item=>item.id===p.id?p:item));}}/>;
  return <div className="project-panel"><header><p className="project-eyebrow">GESTIÓN INSTITUCIONAL</p><h1>Proyectos de vinculación</h1><p>{institution.name}</p><button disabled={loading||busy} onClick={()=>void refresh()}>Actualizar proyectos</button></header>
    {error&&<p role="alert" className="project-error">{error}</p>}
    <div className="project-stats"><div><span>Proyectos</span><strong>{projects.length}</strong></div><div><span>Presupuesto</span><strong>${total.toFixed(2)}</strong></div><div><span>Ejecutado</span><strong>${spent.toFixed(2)}</strong></div><div><span>Saldo</span><strong>${remainingMoney(total,spent).toFixed(2)}</strong></div></div>
    <details className="project-card"><summary>Crear proyecto</summary>
      {loading?<p role="status">Comprobando fechas…</p>:periodError?<p role="alert" className="project-error">No se pudo comprobar la configuración académica. {periodError}</p>:period?<p id="project-period-help">Año lectivo: <strong>{period.name}</strong> · {period.start_date} al {period.end_date}. El proyecto debe comenzar hoy o después y terminar dentro de este período, como máximo a un año desde hoy.</p>:<p id="project-period-help">Puedes registrar las fechas del proyecto: inicio desde hoy y final igual o posterior, como máximo a un año desde hoy. El período lectivo institucional no está disponible para comprobar sus límites.</p>}
      {dateError&&<p id="project-date-error" role="alert" className="project-error">{dateError}</p>}
      <form onSubmit={create}><fieldset disabled={busy||loading||!bounds||Boolean(periodError)} className="project-form-grid">
      <label>Nombre<input name="name" required maxLength={255}/></label><label>Presupuesto aprobado del proyecto (USD)<input name="budget" type="number" required min="0" max={MAX_STORED_MONEY} step="0.01" value={budget} onChange={event=>setBudget(event.target.value)} aria-describedby="project-budget-help"/></label>
      <label>Fecha de inicio<input name="start" type="date" required min={bounds?.min} max={bounds?.max} value={startDate} onChange={event=>setStartDate(event.target.value)} aria-describedby="project-period-help"/></label><label>Fecha de finalización<input name="end" type="date" required min={startDate&&bounds&&startDate>bounds.min?startDate:bounds?.min} max={bounds?.max} value={endDate} onChange={event=>setEndDate(event.target.value)} aria-describedby="project-period-help"/></label>
      <div className="project-wide" id="project-budget-help"><p>Registra el monto autorizado para este proyecto. No representa los ingresos del colegio. Usa USD 0 si no requiere financiamiento.</p>{!loading&&!error&&(projects.length?<p>Referencia institucional: {projects.length} proyectos visibles, con un presupuesto registrado total de USD {total.toFixed(2)}. Este total no representa fondos disponibles para un nuevo proyecto.</p>:<p>No hay proyectos registrados visibles para ofrecer una referencia de presupuesto.</p>)}</div>
      <label className="project-wide">Objetivo y descripción pública<textarea name="description" required rows={3}/></label><button type="submit" disabled={Boolean(dateError)}>{busy?'Guardando…':'Crear proyecto'}</button>
    </fieldset></form></details>
    <div className="project-toolbar"><label>Buscar proyecto<input value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Publicación<select value={publication} onChange={e=>setPublication(e.target.value)}><option value="all">Todos</option><option value="public">Públicos</option><option value="private">Privados</option></select></label></div>
    {loading?<p role="status">Cargando proyectos…</p>:<div className="project-grid">{projects.filter(p=>(p.name+' '+p.description).toLowerCase().includes(search.toLowerCase())&&(publication==='all'||p.is_public===(publication==='public'))).map(p=><article className="project-card" key={p.id}><p className="project-eyebrow">{p.is_public?'Resumen público':'Privado'}</p><h2>{p.name}</h2><p>{p.description}</p><p>{p.start_date||'Sin inicio'} / {p.end_date||'Sin fecha final'}</p><p>Asignado: <strong>${p.budget_total.toFixed(2)}</strong></p><button onClick={()=>setSelected(p)}>Gestionar proyecto</button></article>)}</div>}
    {!loading&&!error&&!projects.length&&<p>No hay proyectos disponibles en esta institución.</p>}
  </div>;
}
