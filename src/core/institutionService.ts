import { supabase } from './supabaseClient';
import type { Institution, InstitutionModuleName, InstitutionModulePermissions } from './TenantContext';

function accessError(subject:string,error:{code?:string}) {
  return new Error(`No se pudieron consultar ${subject} con tu sesión. ${error.code?`Código: ${error.code}. `:''}Reintenta; si persiste, el responsable de accesos debe revisar tu cuenta.`);
}

/** Reads the existing memberships/roles contract; never grants a default role. */
export async function getUserInstitutions(userId: string): Promise<Institution[]> {
  const membership = await supabase.from('memberships').select('institution_id,role_id').eq('profile_id',userId);
  if (membership.error) throw accessError('tus membresías',membership.error);
  if (!membership.data?.length) return [];
  const roles = await supabase.from('roles').select('role_id,name').in('role_id',membership.data.map(m=>m.role_id));
  if (roles.error) throw accessError('tus roles',roles.error);
  const roleById = new Map(roles.data?.map(r=>[r.role_id,r.name]));
  if(membership.data.some(m=>!roleById.has(m.role_id)))throw new Error('Tu membresía existe, pero su rol no está visible para esta sesión. El responsable de accesos debe comprobarlo.');
  const isSuper = membership.data.some(m=>roleById.get(m.role_id)==='super_admin');
  let query = supabase.from('institutions').select('institution_id,name,slug,is_active').eq('is_active',true);
  if (!isSuper) query=query.in('institution_id',membership.data.map(m=>m.institution_id));
  const institutions=await query;
  if(institutions.error)throw accessError('tus instituciones',institutions.error);
  if(!institutions.data?.length)return [];
  const modules=await supabase.rpc('get_accessible_module_settings');
  if(modules.error)throw accessError('los módulos habilitados',modules.error);
  if(!Array.isArray(modules.data))throw new Error('No se pudieron verificar los permisos de módulos de esta sesión.');
  const moduleSettings=modules.data as Array<{institution_id:string;module_name:string;is_enabled:boolean}>;
  return institutions.data.map(i=>{
    const settings=moduleSettings.filter(m=>m.institution_id===i.institution_id);
    const module_permissions:InstitutionModulePermissions={inicio:false,projects:false,portal:false,dece:false,simuladores:false};
    for(const name of Object.keys(module_permissions) as InstitutionModuleName[])module_permissions[name]=settings.some(s=>s.module_name===name&&s.is_enabled===true);
    const enabled=(Object.keys(module_permissions) as InstitutionModuleName[]).filter(name=>module_permissions[name]);
    return {...i,role:isSuper?'super_admin':roleById.get(membership.data.find(m=>m.institution_id===i.institution_id)?.role_id)??'viewer',projects_enabled:module_permissions.projects,enabled_modules:enabled,module_permissions};
  });
}

export async function getPublicInstitutions() {
  const {data,error}=await supabase.from('institutions').select('institution_id,name,slug').eq('is_active',true).order('name');
  if(error)throw error;
  return data??[];
}
export async function publicModuleEnabled(slug: string,moduleName: string) {
  const institution=await supabase.from('institutions').select('institution_id').eq('slug',slug).eq('is_active',true).maybeSingle();
  if(institution.error)throw institution.error;
  if(!institution.data)return false;
  const modules=await supabase.from('module_settings').select('is_enabled').eq('institution_id',institution.data.institution_id).eq('module_name',moduleName).maybeSingle();
  if(modules.error)throw modules.error;
  return modules.data?.is_enabled!==false;
}
