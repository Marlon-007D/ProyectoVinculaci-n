import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '../../../core/AuthContext';
import { useTenant } from '../../../core/TenantContext';
import { useToast } from './Toast/Toast';
import { consumeInvitationSession } from './invitationCompletionNavigation';

export function AdminSessionFeedback({ children }: { children: ReactNode }) {
  const { user, role, institutionId, loading } = useAuth();
  const { activeInstitution, loadingTenant } = useTenant();
  const announced = useRef<string | null>(null);
  const notify = useToast();
  useEffect(() => {
    if (!user) { announced.current = null; return; }
    if (loading || loadingTenant || !role || !activeInstitution || institutionId !== activeInstitution.institution_id) return;
    if (announced.current === user.id) return;
    announced.current = user.id;
    const invited = consumeInvitationSession(user.id, institutionId);
    notify(invited ? 'Contraseña guardada y acceso activado correctamente.' : `Sesión iniciada en ${activeInstitution.name}.`, 'success');
  }, [user, role, institutionId, loading, loadingTenant, activeInstitution, notify]);
  return children;
}
