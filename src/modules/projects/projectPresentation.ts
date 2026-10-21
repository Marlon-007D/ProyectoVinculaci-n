import {isCalendarDate} from './projectValidation';

export const formatMoney = (value:number) => new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(value);
export function formatProjectDate(value:string) {
  if (!isCalendarDate(value)) return 'Sin fecha definida';
  return new Intl.DateTimeFormat('es-EC',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
}
const searchable = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export interface ProjectListing {name:string;description:string;active:boolean;budget:number;spent:number;public:boolean}
export interface ProjectFilters {query:string;status:string;publication:string;sort:string}
/** Sorting creates a new array: the order returned by the service stays intact. */
export function filterProjectList<T>(rows:T[], describe:(row:T)=>ProjectListing, filters:ProjectFilters):T[] {
  const query=searchable(filters.query);
  return rows.filter(row=>{
    const p=describe(row);
    return searchable(`${p.name} ${p.description}`).includes(query)
      && (filters.status==='all'||p.active===(filters.status==='active'))
      && (filters.publication==='all'||p.public===(filters.publication==='public'));
  }).sort((a,b)=>{
    const x=describe(a),y=describe(b);
    if(filters.sort==='budget')return y.budget-x.budget||x.name.localeCompare(y.name,'es');
    if(filters.sort==='spent')return y.spent-x.spent||x.name.localeCompare(y.name,'es');
    if(filters.sort==='name')return x.name.localeCompare(y.name,'es');
    return 0;
  });
}
