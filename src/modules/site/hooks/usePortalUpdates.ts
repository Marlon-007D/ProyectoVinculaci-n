import { useEffect } from 'react';
import { useInstitution } from '../context/InstitutionContext';
import { watchPortalUpdates } from '../services/portalUpdates';

export function usePortalUpdates(refresh: () => void) {
  const { institutionId } = useInstitution();
  useEffect(() => watchPortalUpdates(institutionId, refresh), [institutionId, refresh]);
}
