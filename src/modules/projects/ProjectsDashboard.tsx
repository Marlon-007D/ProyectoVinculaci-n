import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Institution } from '../../core/TenantContext';
import { createProjectService, projectError } from './projectService';
import { ecuadorToday, MAX_STORED_MONEY, projectDateWindow, sumMoney, remainingMoney, validateProjectDates, type ProjectAcademicPeriod } from './projectValidation';
import { ProjectDetails } from './ProjectDetails';
import type { Project } from './types';
import {ArrowUpRight,CalendarDays,FolderPlus,Globe2,LockKeyhole,Plus,RefreshCw,Search,Users} from 'lucide-react';
import {FinancialProgress,ProjectBadge,ProjectEmpty,ProjectLoading,ProjectMetrics} from './ProjectVisuals';
import {filterProjectList,formatMoney,formatProjectDate} from './projectPresentation';
import './projects.css';
export function ProjectsDashboard({ institution }: { institution: Institution }) {
  const service=useMemo(()=>createProjectService(institution.institution_id),[institution.institution_id]);
  const [projects,setProjects]=useState<Project[]>([]);const [selected,setSelected]=useState<Project|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<ProjectAcademicPeriod|null>(null);const [periodError,setPeriodError]=useState('');
  const [startDate,setStartDate]=useState('');const [endDate,setEndDate]=useState('');const [budget,setBudget]=useState('');
  const [search,setSearch]=useState('');const [publication,setPublication]=useState('all');const [status,setStatus]=useState('all');const [sort,setSort]=useState('default');
  const createPanel=useRef<HTMLDetailsElement>(null);const firstInput=useRef<HTMLInputElement>(null);
  const request=useRef(0);const lock=useRef(false);
  const load=useCallback(async()=>{
    const id=++request.current;
    const [projectResult,periodResult]=await Promise.allSettled([service.getProjects(),service.getAcademicPeriod()]);
    if(id!==request.current)return;
    if(projectResult.status==='fulfilled')setProjects(projectResult.value.data);else{setProjects([]);setError(projectError(projectResult.reason));}
    if(periodResult.status==='fulfilled')setPeriod(periodResult.value);else{setPeriod(null);setPeriodError(projectError(periodResult.reason));}
    setLoading(false);
  },[service]);
  useEffect(()=>{const pending=request;void load();return()=>{pending.current++;};},[load]);
  function refresh(){setLoading(true);setError('');setPeriodError('');return load();}
  async function create(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(lock.current)return;const form=event.currentTarget;const data=new FormData(form);lock.current=true;setBusy(true);setError('');
    try{const result=await service.createProject({name:String(data.get('name')),description:String(data.get('description')),budget_total:Number(data.get('budget')),start_date:startDate,end_date:endDate});setProjects(old=>[result.data,...old]);form.reset();setStartDate('');setEndDate('');setBudget('');setSelected(result.data);}catch(e){setError(projectError(e));}finally{lock.current=false;setBusy(false);}
  }
  let bounds:{min:string;max:string}|null=null;let dateError='';
  try{bounds=projectDateWindow(period,ecuadorToday());if(startDate&&endDate)validateProjectDates(startDate,endDate,period??undefined,ecuadorToday());}catch(cause){dateError=projectError(cause);}
  const total=sumMoney(projects.map(p=>p.budget_total));const spent=sumMoney(projects.flatMap(p=>p.budget_items.map(b=>b.spent_amount)));
  const visible=filterProjectList(projects,p=>({name:p.name,description:p.description,active:p.is_active,budget:p.budget_total,spent:sumMoney(p.budget_items.map(b=>b.spent_amount)),public:p.is_public}),{query:search,status,publication,sort});
  function clearFilters(){setSearch('');setPublication('all');setStatus('all');setSort('default');}
  function openCreate(){if(createPanel.current){createPanel.current.open=true;createPanel.current.scrollIntoView({block:'start'});firstInput.current?.focus({preventScroll:true});}}
  if(selected)return <ProjectDetails project={selected} institutionName={institution.name} canPublish={['super_admin','institution_admin'].includes(institution.role)} onBack={()=>{setSelected(null);void refresh();}} onProjectUpdate={p=>{setSelected(p);setProjects(old=>old.map(item=>item.id===p.id?p:item));}}/>;
  return <div className="project-panel project-dashboard"><header className="project-hero"><div className="project-hero-copy"><p className="project-eyebrow">GESTIÓN INSTITUCIONAL · {institution.name}</p><h1>Proyectos que construyen comunidad.</h1><p>Organiza tu equipo, distribuye el presupuesto y da seguimiento a cada gasto desde un solo lugar.</p><div className="project-hero-actions"><button className="project-primary" disabled={loading||busy} onClick={openCreate}><Plus size={18} aria-hidden="true"/>Nuevo proyecto</button><button className="project-hero-secondary" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={16} aria-hidden="true"/>Actualizar</button></div></div><div className="project-hero-aside"><FolderPlus size={32} aria-hidden="true"/><span>TU ESPACIO DE TRABAJO</span><strong>{loading||error?'—':projects.filter(p=>p.is_active).length}</strong><p>proyectos en ejecución</p></div></header>
    {error&&<p role="alert" className="project-error">{error}</p>}
    <ProjectMetrics count={projects.length} budget={total} spent={spent} available={!loading&&!error}/>
    <details className="project-card project-create" ref={createPanel}><summary><Plus size={18} aria-hidden="true"/><span>Crear un proyecto<small>Define su objetivo, presupuesto y período de ejecución.</small></span></summary>
      {loading?<p role="status">Comprobando fechas…</p>:periodError?<p role="alert" className="project-error">No se pudo comprobar la configuración académica. {periodError}</p>:period?<p id="project-period-help">Año lectivo: <strong>{period.name}</strong> · {period.start_date} al {period.end_date}. El proyecto debe comenzar hoy o después y terminar dentro de este período, como máximo a un año desde hoy.</p>:<p id="project-period-help">Puedes registrar las fechas del proyecto: inicio desde hoy y final igual o posterior, como máximo a un año desde hoy. El período lectivo institucional no está disponible para comprobar sus límites.</p>}
      {dateError&&<p id="project-date-error" role="alert" className="project-error">{dateError}</p>}
      <form onSubmit={create}><fieldset disabled={busy||loading||!bounds||Boolean(periodError)} className="project-form-grid">
      <label>Nombre del proyecto<input ref={firstInput} name="name" required maxLength={255} placeholder="Por ejemplo: Huerto escolar comunitario"/></label><label>Presupuesto aprobado (USD)<input name="budget" type="number" required min="0" max={MAX_STORED_MONEY} step="0.01" value={budget} onChange={event=>setBudget(event.target.value)} aria-describedby="project-budget-help" placeholder="0,00"/></label>
      <label>Fecha de inicio<input name="start" type="date" required min={bounds?.min} max={bounds?.max} value={startDate} onChange={event=>setStartDate(event.target.value)} aria-describedby="project-period-help"/></label><label>Fecha de finalización<input name="end" type="date" required min={startDate&&bounds&&startDate>bounds.min?startDate:bounds?.min} max={bounds?.max} value={endDate} onChange={event=>setEndDate(event.target.value)} aria-describedby="project-period-help"/></label>
      <p className="project-wide project-form-help" id="project-budget-help">Registra el monto autorizado para este proyecto. Puedes usar USD 0 si no requiere financiamiento. El saldo de otros proyectos no representa fondos disponibles para uno nuevo.</p>
      <label className="project-wide">Objetivo y descripción pública<textarea name="description" required rows={3} placeholder="¿Qué se quiere lograr y a quién beneficiará?"/><small>Este texto podrá mostrarse en Transparencia cuando un administrador apruebe el resumen.</small></label><button className="project-primary" type="submit" disabled={Boolean(dateError)}><Plus size={16} aria-hidden="true"/>{busy?'Guardando…':'Crear proyecto'}</button>
    </fieldset></form></details>
    <div className="project-section-heading"><div><p className="project-eyebrow">CARTERA DE PROYECTOS</p><h2>Todo bajo seguimiento</h2></div><span>{!loading&&!error?`${projects.length} registrados`:'Consultando información'}</span></div>
    <div className="project-filters"><label className="project-search">Buscar proyecto<div><Search size={17} aria-hidden="true"/><input type="search" placeholder="Nombre u objetivo…" value={search} onChange={e=>setSearch(e.target.value)}/></div></label><label>Estado<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">En ejecución</option><option value="closed">Cerrados</option></select></label><label>Visibilidad<select value={publication} onChange={e=>setPublication(e.target.value)}><option value="all">Todos</option><option value="public">Resumen público</option><option value="private">Privados</option></select></label><label>Ordenar por<select value={sort} onChange={e=>setSort(e.target.value)}><option value="default">Orden original</option><option value="name">Nombre A–Z</option><option value="budget">Mayor presupuesto</option><option value="spent">Mayor gasto</option></select></label></div>
    {!loading&&!error&&<div className="project-results"><span role="status">{visible.length} de {projects.length} proyectos</span>{(search||status!=='all'||publication!=='all'||sort!=='default')&&<button className="project-text-button" onClick={clearFilters}>Limpiar filtros</button>}</div>}
    {loading?<ProjectLoading/>:!error&&<div className="project-grid project-list-grid">{visible.map(p=>{const used=sumMoney(p.budget_items.map(b=>b.spent_amount));return <article className="project-card project-list-card" key={p.id}><div className="project-card-top"><ProjectBadge active={p.is_active}/><span className="project-visibility">{p.is_public?<Globe2 size={14} aria-hidden="true"/>:<LockKeyhole size={14} aria-hidden="true"/>}{p.is_public?'Público':'Privado'}</span></div><h3>{p.name}</h3><p className="project-card-description">{p.description}</p><div className="project-card-dates"><CalendarDays size={15} aria-hidden="true"/><span>{formatProjectDate(p.start_date)} — {formatProjectDate(p.end_date)}</span></div><dl className="project-card-money"><div><dt>Presupuesto</dt><dd>{formatMoney(p.budget_total)}</dd></div><div><dt>Saldo</dt><dd>{formatMoney(remainingMoney(p.budget_total,used))}</dd></div></dl><FinancialProgress budget={p.budget_total} spent={used} compact/><footer><span><Users size={15} aria-hidden="true"/>{p.members.length} participantes · {p.budget_items.length} rubros</span><button onClick={()=>setSelected(p)} aria-label={`Gestionar ${p.name}`}>Gestionar<ArrowUpRight size={17} aria-hidden="true"/></button></footer></article>;})}</div>}
    {!loading&&!error&&!projects.length&&<ProjectEmpty title="Tu próximo proyecto empieza aquí" action={<button className="project-primary" onClick={openCreate}><Plus size={16} aria-hidden="true"/>Crear el primer proyecto</button>}>Registra el objetivo y el presupuesto. Después podrás añadir rubros, gastos y participantes.</ProjectEmpty>}
    {!loading&&!error&&projects.length>0&&!visible.length&&<ProjectEmpty title="No encontramos coincidencias" action={<button onClick={clearFilters}>Ver todos los proyectos</button>}>Prueba con otro nombre o ajusta los filtros de estado y visibilidad.</ProjectEmpty>}
  </div>;
}
