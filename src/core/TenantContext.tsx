import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface Institution {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface TenantContextType {
  activeInstitution: Institution | null;
  setActiveInstitution: (inst: Institution | null) => void;
  loadingTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeInstitution, setActiveInstitution] = useState<Institution | null>(null);
  const [loadingTenant, setLoadingTenant] = useState<boolean>(true);

  useEffect(() => {
    // Carga la primera institución activa por defecto si no hay una seleccionada
    const loadDefaultTenant = async () => {
      const { data } = await supabase
        .from('institutions')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (data) setActiveInstitution(data);
      setLoadingTenant(false);
    };

    loadDefaultTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ activeInstitution, setActiveInstitution, loadingTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe ser usado dentro de TenantProvider');
  return context;
};