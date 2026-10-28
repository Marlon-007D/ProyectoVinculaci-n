import {ecuadorToday, isCalendarDate} from './projectValidation';

export const formatMoney = (value:number) => new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(value);
/** «57,11 %» with a non-breaking space, the same in screens, PDF reports and the public portal. */
export const formatPercent = (value:number) => `${new Intl.NumberFormat('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}\u00a0%`;
export const plural = (count:number, one:string, many:string) => `${count} ${count===1?one:many}`;
export function formatProjectDate(value:string) {
  if (!isCalendarDate(value)) return 'Sin fecha definida';
  return new Intl.DateTimeFormat('es-EC',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
}
/** dd/mm/aaaa, for spreadsheets and tables. */
export function formatNumericDate(value:string) {
  return isCalendarDate(value)?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:'';
}
/** File-name fragment: no accents, spaces or symbols. */
export function fileSlug(text:string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'sin_nombre';
}
export const reportFileName = (prefix:string, name:string, extension:string, today=ecuadorToday()) => `${prefix}_${fileSlug(name)}_${today}.${extension}`;

export function saveBlob(filename:string, blob:Blob) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const searchable =(value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
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
