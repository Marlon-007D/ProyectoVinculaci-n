export type InstitutionModuleName='inicio'|'projects'|'dece'|'simuladores'|'portal';
export type InstitutionModulePermissions=Record<InstitutionModuleName,boolean>;
export interface Institution {
  institution_id:string;name:string;slug:string;is_active:boolean;role:string;
  projects_enabled:boolean;enabled_modules:InstitutionModuleName[];module_permissions:InstitutionModulePermissions;
}
export type AccessState =
  | {kind:'checking'}
  | {kind:'signed-out'}
  | {kind:'mfa';factorId:string}
  | {kind:'ready';userId:string;institutions:Institution[]}
  | {kind:'unavailable';message:string};
export interface ModuleAccessPort {
  check():Promise<AccessState>;
  login(email:string,password:string):Promise<void>;
  verify(factorId:string,code:string):Promise<void>;
  logout():Promise<void>;
  subscribe(onChange:()=>void):()=>void;
}
