import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { supabase } from '../../core/supabaseClient';
import { RegisterPage } from './RegisterPage';
import type { RegistrationService } from './registration.types';

export function RegistrationRoute() {
  const { register, user } = useAuth();
  const service = useMemo<RegistrationService>(() => ({
    async listInstitutions() {
      const { data, error } = await supabase.rpc('registration_institutions');
      if (error) throw error;
      return data ?? [];
    },
    async register(input) {
      const result = await register(input.email, input.password, input.firstName, input.lastName, input.institutionId);
      if (result.error) throw result.error;
    },
  }), [register]);
  if (user) return <Navigate to="/panel/admin" replace />;
  return <RegisterPage service={service} />;
}
