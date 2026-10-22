import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { publicSupabase } from '../../core/supabase/publicClient';
import { RegisterPage } from './RegisterPage';
import type { RegistrationService } from './registration.types';

export function RegistrationRoute() {
  const { register, user } = useAuth();
  const service = useMemo<RegistrationService>(() => ({
    async listInstitutions() {
      const { data, error } = await publicSupabase.rpc('registration_institutions');
      if (error) throw error;
      const catalog = data ?? [];
      const { data: publicInstitutions } = await publicSupabase.from('institutions')
        .select('institution_id, slug').eq('is_active', true);
      return catalog.map((item: { institution_id: string; name: string }) => ({
        ...item,
        slug: publicInstitutions?.find(row => row.institution_id === item.institution_id)?.slug,
      }));
    },
    async register(input) {
      const result = await register(input.email, input.password, input.firstName, input.lastName, input.institutionId);
      if (result.error) throw result.error;
    },
  }), [register]);
  if (user) return <Navigate to="/panel/admin" replace />;
  return <RegisterPage service={service} />;
}
