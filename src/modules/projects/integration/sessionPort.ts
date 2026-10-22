import {supabase} from '../../../core/supabaseClient';
import {getUserInstitutions} from './accessService';
import type {ModuleAccessPort} from './moduleTypes';

/** Module-scoped adapter. It neither replaces shared Auth nor creates users/roles. */
export const moduleAccess:ModuleAccessPort={
  async check(){
    const session=await supabase.auth.getSession();if(session.error)throw session.error;
    if(!session.data.session)return {kind:'signed-out'};
    const user=await supabase.auth.getUser();if(user.error)throw user.error;
    if(!user.data.user)return {kind:'signed-out'};
    const assurance=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error)throw assurance.error;
    if(assurance.data.currentLevel!=='aal2'&&assurance.data.nextLevel==='aal2'){
      const factors=await supabase.auth.mfa.listFactors();if(factors.error)throw factors.error;
      const factor=factors.data.totp.find(item=>item.status==='verified');
      if(!factor)return {kind:'unavailable',message:'Tu cuenta requiere una verificación que debe completar el responsable de accesos.'};
      return {kind:'mfa',factorId:factor.id};
    }
    const verified=await supabase.rpc('projects_session_verified');if(verified.error)throw verified.error;
    if(verified.data!==true)return {kind:'unavailable',message:'La sesión no cumple los requisitos de seguridad de la institución. Solicita la configuración de tu acceso.'};
    return {kind:'ready',userId:user.data.user.id,institutions:await getUserInstitutions(user.data.user.id)};
  },
  async login(email,password){const result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;},
  async verify(factorId,code){
    const challenge=await supabase.auth.mfa.challenge({factorId});if(challenge.error)throw challenge.error;
    const result=await supabase.auth.mfa.verify({factorId,challengeId:challenge.data.id,code});if(result.error)throw result.error;
  },
  async logout(){const result=await supabase.auth.signOut();if(result.error)throw result.error;},
  subscribe(onChange){const {data}=supabase.auth.onAuthStateChange(onChange);return()=>data.subscription.unsubscribe();},
};
