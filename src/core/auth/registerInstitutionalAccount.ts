import { publicSupabase } from '../supabase/publicClient';
import { performInstitutionalRegistration } from './registrationFlow';

// Public registration never sends Auth emails or establishes a session.
export async function registerInstitutionalAccount(email: string, password: string, firstName: string, lastName: string, institutionId: string) {
  return performInstitutionalRegistration(publicSupabase.functions, {
    email, password, firstName, lastName, institutionId,
  });
}
