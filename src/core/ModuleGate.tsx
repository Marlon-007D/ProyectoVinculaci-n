import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export function ModuleGate({moduleName,children}:{moduleName:string;children:ReactNode}){
  const {user,loading}=useAuth();
  const {activeInstitution,loadingTenant,tenantError,reloadInstitutions}=useTenant();
  if(loading||loadingTenant)return <p className="p-8" role="status">Comprobando acceso institucional…</p>;
  if(!user)return <div className="p-8"><p>Inicia sesión para abrir este módulo.</p><a href="/panel/admin" className="underline">Iniciar sesión</a></div>;
  if(tenantError)return <div className="p-8"><p role="alert">{tenantError}</p><button className="mt-3 rounded border px-4 py-2" onClick={reloadInstitutions}>Reintentar consulta</button></div>;
  if(!activeInstitution)return <div className="p-8"><p role="alert">Tu sesión está iniciada, pero no hay una institución activa visible para tu cuenta. Puede faltar la membresía o estar restringida su lectura. Pide al responsable de accesos que lo compruebe.</p><button className="mt-3 rounded border px-4 py-2" onClick={reloadInstitutions}>Volver a comprobar acceso</button></div>;
  if(activeInstitution.enabled_modules&&!activeInstitution.enabled_modules.includes(moduleName))return <p className="p-8" role="alert">Este módulo está deshabilitado para {activeInstitution.name}.</p>;
  return <>{children}</>;
}
