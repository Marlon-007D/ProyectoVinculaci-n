import { supabase } from '../../core/supabaseClient';
import { ecuadorToday, isCalendarDate, isMoney, MAX_STORED_MONEY, projectDateWindow, remainingMoney, sumMoney, toCents, validateProjectDates, type ProjectAcademicPeriod } from './projectValidation';
import type { BudgetItem, Expense, MemberOption, Project, ProjectMember } from './types';
interface ProfileRow { profile_id: string; first_name: string; last_name: string; email: string }
interface MemberRow { deleted_at?:string|null; revision?:number; full_name?:string; email?:string; project_member_id: string; project_id: string; profile_id: string; role: ProjectMember['role']; profiles?: ProfileRow | null }
interface ExpenseRow { deleted_at?:string|null; revision?:number; expense_id: string; budget_item_id: string; description: string; amount: number; expense_date: string }
interface ItemRow { deleted_at?:string|null; revision?:number; budget_item_id: string; project_id: string; name: string; allocated_amount: number; expenses?: ExpenseRow[] }
interface ProjectRow { deleted_at?:string|null; revision?:number; is_active: boolean; project_id: string; institution_id: string; title: string; description: string; total_budget: number; is_public: boolean; start_date: string; end_date: string; updated_at?: string; budget_items?: ItemRow[]; project_members?: MemberRow[] }
const columns='*,budget_items(*,expenses(*)),project_members(*)';
const memberFromRow=(m:MemberRow):ProjectMember=>({...m,full_name:m.full_name??(m.profiles?[m.profiles.first_name,m.profiles.last_name].filter(Boolean).join(' '):'Perfil no visible'),email:m.email??m.profiles?.email??''});
const expenseFromRow=(e:ExpenseRow):Expense=>({...e,amount:Number(e.amount),date:e.expense_date});
export function mapProject(row:ProjectRow):Project {
  return {id:row.project_id,institution_id:row.institution_id,name:row.title,description:row.description??'',budget_total:Number(row.total_budget),is_public:row.is_public,is_active:row.is_active,start_date:row.start_date??'',end_date:row.end_date??'',updated_at:row.updated_at,deleted_at:row.deleted_at,revision:row.revision,
    budget_items:(row.budget_items??[]).filter(b=>!b.deleted_at).map(b=>({...b,allocated_amount:Number(b.allocated_amount),spent_amount:sumMoney((b.expenses??[]).filter(e=>!e.deleted_at).map(e=>Number(e.amount))),expenses:(b.expenses??[]).filter(e=>!e.deleted_at).map(expenseFromRow)})),members:(row.project_members??[]).filter(m=>!m.deleted_at).map(memberFromRow)};
}
export function projectError(error:unknown):string {
  if(error&&typeof error==='object'&&'code' in error){
    if(error.code==='42501'){
      const detail='message'in error?String(error.message):'';
      const table=detail.match(/permission denied for table ([a-zA-Z_][a-zA-Z_0-9]*)/i)?.[1];
      return `Supabase rechazó el acceso${table?` a la tabla ${table}`:''} (código 42501). Tu sesión no tiene permiso para esta operación. El responsable de accesos debe revisar tu membresía y los permisos existentes. No se ha confirmado ningún cambio.`;
    }
    if(['42703','42P01','PGRST200','PGRST204'].includes(String(error.code)))return 'La estructura disponible no coincide con la consulta. Revisa el esquema y los permisos existentes con el responsable técnico.';
    if(error.code==='23505')return 'Ese registro ya existe. Actualiza los datos antes de continuar.';
  }
  return error&&typeof error==='object'&&'message' in error?String(error.message):'No se pudo completar la operación. Comprueba la conexión e inténtalo de nuevo.';
}
function checkMoney(amount:number,positive=true){if(!isMoney(amount)||amount>MAX_STORED_MONEY||(positive?amount<=0:amount<0))throw new Error('Introduce un importe válido con máximo dos decimales y dentro de la capacidad del registro.');}
function requireLogicalDeletion(project:Project){if(project.revision===undefined)throw new Error('La eliminación lógica todavía no está habilitada. No se ha retirado ningún registro.');}
export function createProjectService(institutionId:string,today:()=>string=ecuadorToday,revision?:number) {
  if(!institutionId)throw new Error('Selecciona una institución.');
  let atomicReads:boolean|undefined;
  async function readProjects(projectId:string|null,offset=0):Promise<ProjectRow[]|null>{
    if(atomicReads===false)return null;
    const {data,error}=await supabase.rpc('project_read',{target_institution:institutionId,target_project:projectId,page_offset:offset,page_size:200});
    if(error){
      // Compatibility while the reviewed migration is still pending. Permission failures never fall back.
      if(error.code==='PGRST202'){atomicReads=false;return null;}
      throw error;
    }
    if(!Array.isArray(data))throw new Error('No se pudo comprobar la respuesta de proyectos.');
    atomicReads=true;return data as ProjectRow[];
  }
  async function operation<T>(operation:string,payload:Record<string,unknown>):Promise<T>{
    const {data,error}=await supabase.rpc('project_operation',{target_institution:institutionId,operation,payload:{...payload,...(revision === undefined ? {} : {expected_revision:revision})}});
    if(error)throw error;return data as T;
  }
  async function getAcademicPeriod():Promise<ProjectAcademicPeriod|null>{
    const {data,error}=await supabase.from('academic_periods').select('academic_period_id,name,start_date,end_date').eq('institution_id',institutionId).eq('is_active',true).limit(2);
    if(error){if(error.code==='42501')return null;throw error;}
    if(!data?.length)return null;
    if(data.length!==1)throw new Error('Hay más de un período lectivo activo. Solicita al responsable académico que revise cuál corresponde.');
    projectDateWindow(data[0],today());return data[0];
  }
  async function getProject(id:string){
    const records=await readProjects(id);
    if(records){if(records.length!==1)throw new Error('Proyecto inexistente o no autorizado.');return mapProject(records[0]);}
    const {data,error}=await supabase.from('projects').select(columns).eq('institution_id',institutionId).eq('project_id',id).single();
    if(error)throw error;return mapProject(data as unknown as ProjectRow);
  }
  async function getBudget(projectId:string,budgetId:string){
    const project=await getProject(projectId);const item=project.budget_items.find(b=>b.budget_item_id===budgetId);
    if(!item)throw new Error('Rubro no disponible en este proyecto.');return {project,item};
  }
  async function getMemberOptions():Promise<MemberOption[]>{
    const {data,error}=await supabase.rpc('project_member_options',{target_institution:institutionId});
    if(error)throw error;
    return (data??[]) as MemberOption[];
  }
  return {
    getProject,getMemberOptions,getAcademicPeriod,
    async updateProject(projectId:string,input:{name:string;description:string;budget_total:number;start_date:string;end_date:string}) {
      checkMoney(input.budget_total,false);
      if(!input.name.trim()||input.name.trim().length>255)throw new Error('Introduce un nombre de hasta 255 caracteres.');
      if(!isCalendarDate(input.start_date)||!isCalendarDate(input.end_date)||input.end_date<input.start_date)throw new Error('Introduce un período de ejecución válido.');
      const project=await getProject(projectId);
      if(toCents(input.budget_total)<toCents(sumMoney(project.budget_items.map(b=>b.allocated_amount))))throw new Error('El presupuesto no puede ser menor a la suma de los rubros.');
      if(project.budget_items.some(b=>b.expenses.some(e=>e.date<input.start_date||e.date>input.end_date)))throw new Error('Las fechas deben incluir los gastos vigentes.');
      await operation('update_project',{project_id:projectId,...input,name:input.name.trim(),description:input.description.trim()});
    },
    async archiveProject(projectId:string){await operation('archive_project',{project_id:projectId});},
    async restoreProject(projectId:string,expectedRevision?:number){await operation('restore_project',{project_id:projectId,...(expectedRevision===undefined?{}:{expected_revision:expectedRevision})});},
    async updateProjectMember(projectId:string,memberId:string,role:string){
      if(!role.trim()||role.trim().length>100)throw new Error('Introduce una responsabilidad de hasta 100 caracteres.');
      await operation('update_member',{project_id:projectId,project_member_id:memberId,role:role.trim()});
    },
    async updateExpense(budgetId:string,projectId:string,expenseId:string,amount:number,description:string,date:string){
      checkMoney(amount);
      if(!description.trim()||!isCalendarDate(date))throw new Error('Completa el concepto y una fecha válida del gasto.');
      const {project,item}=await getBudget(projectId,budgetId);
      const expense=item.expenses.find(e=>e.expense_id===expenseId);
      if(!expense)throw new Error('Gasto no disponible.');
      if(date<project.start_date||date>project.end_date||date>today())throw new Error('La fecha debe estar dentro del proyecto y no puede ser futura.');
      if(toCents(amount)>toCents(item.allocated_amount)-toCents(item.spent_amount)+toCents(expense.amount))throw new Error('El gasto supera el saldo disponible del rubro.');
      await operation('update_expense',{project_id:projectId,budget_item_id:budgetId,expense_id:expenseId,amount,description:description.trim(),date});
    },
    async setStatus(projectId:string,active:boolean){await operation('set_status',{project_id:projectId,active});},
    async getProjects():Promise<{data:Project[];source:'supabase'}>{
      const projects:Project[]=[];
      const batchSize=200;
      for(let offset=0;;offset+=batchSize){
        const records=await readProjects(null,offset);
        if(records){projects.push(...records.map(mapProject));if(records.length<batchSize)break;continue;}
        const {data,error}=await supabase.from('projects').select(columns).eq('institution_id',institutionId).order('created_at',{ascending:false}).order('project_id').range(offset,offset+batchSize-1);
        if(error)throw error;
        projects.push(...(data??[]).map(row=>mapProject(row as unknown as ProjectRow)));
        if(!data||data.length<batchSize)break;
      }
      return {data:projects,source:'supabase'};
    },
    async createProject(input:{name:string;description:string;budget_total:number;start_date:string;end_date:string}){
      checkMoney(input.budget_total,false);
      if(!input.name.trim()||input.name.length>255)throw new Error('Introduce un nombre de hasta 255 caracteres.');
      validateProjectDates(input.start_date,input.end_date,undefined,today());
      const period=await getAcademicPeriod();
      validateProjectDates(input.start_date,input.end_date,period??undefined,today());
      const data=await operation<ProjectRow>('create_project',{...input,name:input.name.trim(),description:input.description.trim()});
      return {data:mapProject(data),source:'supabase' as const};
    },
    async setPublication(projectId:string,published:boolean){
      await getProject(projectId);
      const data=await operation<ProjectRow>('publish',{project_id:projectId,published});return data.is_public;
    },
    async addBudgetItem(projectId:string,name:string,amount:number):Promise<BudgetItem>{
      checkMoney(amount);if(!name.trim())throw new Error('Escribe el nombre del rubro.');
      const project=await getProject(projectId);
      if(toCents(sumMoney(project.budget_items.map(b=>b.allocated_amount)))+toCents(amount)>toCents(project.budget_total))throw new Error('Los rubros superan el presupuesto disponible.');
      const data=await operation<ItemRow>('add_budget',{project_id:projectId,name:name.trim(),amount});
      return {...data,allocated_amount:Number(data.allocated_amount),spent_amount:0,expenses:[]};
    },
    async updateBudgetItem(projectId:string,budgetId:string,name:string,amount:number){
      checkMoney(amount);if(!name.trim())throw new Error('Escribe el nombre del rubro.');
      const {project,item}=await getBudget(projectId,budgetId);
      if(toCents(amount)<toCents(item.spent_amount))throw new Error('La asignación no puede ser menor al gasto ejecutado.');
      const other=sumMoney(project.budget_items.filter(b=>b.budget_item_id!==budgetId).map(b=>b.allocated_amount));
      if(toCents(other)+toCents(amount)>toCents(project.budget_total))throw new Error('Los rubros superan el presupuesto del proyecto.');
      await operation('update_budget',{project_id:projectId,budget_item_id:budgetId,name:name.trim(),amount});
    },
    async deleteBudgetItem(projectId:string,budgetId:string){
      const {project,item}=await getBudget(projectId,budgetId);requireLogicalDeletion(project);if(item.expenses.length)throw new Error('No se puede eliminar un rubro con gastos.');
      await operation('delete_budget',{project_id:projectId,budget_item_id:budgetId});
    },
    async addExpense(budgetId:string,projectId:string,amount:number,description:string,date:string):Promise<Expense>{
      checkMoney(amount);if(!description.trim()||!isCalendarDate(date))throw new Error('Completa el concepto y una fecha válida del gasto.');
      const {project,item}=await getBudget(projectId,budgetId);
      if(date<project.start_date||date>project.end_date||date>today())throw new Error('La fecha debe estar dentro del proyecto y no puede ser futura.');
      if(toCents(amount)>toCents(remainingMoney(item.allocated_amount,item.spent_amount)))throw new Error('El gasto supera el saldo disponible del rubro.');
      const data=await operation<ExpenseRow>('add_expense',{project_id:projectId,budget_item_id:budgetId,amount,description:description.trim(),date});
      return expenseFromRow(data);
    },
    async deleteExpense(budgetId:string,projectId:string,expenseId:string){
      const {project,item}=await getBudget(projectId,budgetId);requireLogicalDeletion(project);if(!item.expenses.some(e=>e.expense_id===expenseId))throw new Error('Gasto no disponible en este rubro.');
      await operation('delete_expense',{project_id:projectId,budget_item_id:budgetId,expense_id:expenseId});
    },
    async addProjectMember(projectId:string,member:{profile_id:string;role:ProjectMember['role']}):Promise<void>{
      if(!member.role.trim()||member.role.trim().length>100)throw new Error('Introduce una responsabilidad de hasta 100 caracteres.');
      await getProject(projectId);
      const options=await getMemberOptions();if(!options.some(p=>p.profile_id===member.profile_id))throw new Error('Selecciona un perfil de esta institución.');
      await operation('add_member',{project_id:projectId,profile_id:member.profile_id,role:member.role.trim()});
    },
    async removeProjectMember(projectId:string,memberId:string){
      requireLogicalDeletion(await getProject(projectId));
      await operation('delete_member',{project_id:projectId,project_member_id:memberId});
    },
  };
}
