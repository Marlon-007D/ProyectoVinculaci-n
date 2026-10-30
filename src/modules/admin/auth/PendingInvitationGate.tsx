import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../core/TenantContext';
import { useAuth } from '../../../core/AuthContext';
import { supabase } from '../../../core/supabaseClient';
import { createInvitationAccountService } from './invitationAccount';
import { InvitationAcceptance } from './InvitationAcceptance';
import { markInvitationSession, replaceInvitationHistory } from './invitationCompletionNavigation';
import { useToast, useToastMessage } from './Toast/Toast';
import { completeInvitationAccount } from './completeInvitationAccount';

const accounts = createInvitationAccountService(supabase);

/** Only the acceptance screen is available here; no panel access is granted. */
export function PendingInvitationGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { reloadInstitutions } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useToast();
  const [completed, setCompleted] = useState<string | null>(null);
  const params = new URLSearchParams(location.search);
  const institutionId = params.get('institution') ?? params.get('institution_id') ?? '';
  const slug = params.get('slug') ?? '';
  const userId = user?.id;
  const key = `${userId ?? ''}:${institutionId}`;
  const [probe, setProbe] = useState<{ key: string; pending: boolean; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  useToastMessage(probe?.key === key ? probe.error : null);
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        if (!userId || !institutionId) { if (active) setProbe({ key, pending: false }); return; }
        const result = await supabase.rpc('admin_tenant_own_invitation', { target_institution_id: institutionId });
        if (result.error && result.error.code !== 'PGRST202') throw new Error('No se pudo consultar la invitación de esta institución.');
        if (!active) return;
        const data: unknown = result.data;
        let pending = Boolean(data && typeof data === 'object' && 'pending' in data && data.pending === true);
        if (pending && data && typeof data === 'object' && 'requires_password' in data && data.requires_password === false) {
          await accounts.accept(institutionId);
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.error) throw refreshed.error;
          if (!active) return;
          reloadInstitutions();
          const destination = replaceInvitationHistory(window.history, institutionId, slug);
          void navigate(destination, { replace: true });
          notify('Acceso activado correctamente.', 'success');
          pending = false;
        }
        if (active) setProbe({ key, pending });
      } catch {
        if (active) setProbe({ key, pending: false, error: 'No se pudo verificar tu invitación. Revisa la conexión y vuelve a intentarlo.' });
      }
    }
    void check();
    return () => { active = false; };
  }, [userId, institutionId, key, revision]);
  if (!user || completed === key) return children;
  if (probe?.key !== key) return <p role="status">Consultando tu acceso institucional…</p>;
  if (probe.error) return <section><p>{probe.error}</p><button type="button" onClick={() => { setProbe(null); setRevision(value => value + 1); }}>Reintentar</button></section>;
  if (!probe.pending) return children;
  return <InvitationAcceptance userId={user.id} institutionId={institutionId} slug={slug} institutionName={slug} service={accounts} complete={async password => {
    const { details, synchronized } = await completeInvitationAccount(supabase.auth, accounts, {
      userId: user.id, institutionId, slug, password,
    }, async (targetInstitutionId, passwordValue) => {
      const { data, error } = await supabase.functions.invoke<{ passwordSaved?: boolean; error?: string }>('admin-tenant-invite', {
        body: { action: 'complete_invitation_password', institutionId: targetInstitutionId, password: passwordValue },
      });
      if (error || data?.passwordSaved !== true) {
        if (error && 'context' in error && error.context instanceof Response) {
          const failure: unknown = await error.context.json().catch(() => null);
          if (failure && typeof failure === 'object' && 'error' in failure && typeof failure.error === 'string') {
            throw new Error(failure.error);
          }
        }
        if (data?.error) throw new Error(data.error);
        throw new Error('No se pudo guardar la contraseña mediante el servidor. Verifica que admin-tenant-invite incluya la acción complete_invitation_password y abre un enlace de correo reciente.');
      }
    }, () => window.sessionStorage.setItem('auth-login-method', 'password'));
    if (!synchronized) notify('El acceso está activado, pero no se pudo actualizar la sesión. Vuelve a iniciar sesión.', 'warning');
    const destination = replaceInvitationHistory(window.history, institutionId, details.slug);
    if (synchronized) markInvitationSession(user.id, institutionId);
    void navigate(destination, { replace: true });
    setCompleted(key);
  }} />;
}
