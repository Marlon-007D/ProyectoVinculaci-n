import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { supabase } from '../../../core/supabaseClient';
import { ToastBoundary, useToastMessage } from './Toast/Toast';
import { expiredInvitationMessage, invitationLanding, parseInvitationLink } from './invitationLink';
import styles from './CompleteInvitation.module.css';
import { captureInvitationSession } from './invitationLinkSession';
import { RequestInvitationEmail } from './RequestInvitationEmail';
import { requestInvitationEmailService } from './requestInvitationEmailService';

export function InvitationLinkBoundary({ children }: { children: ReactNode }) {
  return <ToastBoundary><InvitationLinkContent>{children}</InvitationLinkContent></ToastBoundary>;
}

function InvitationLinkContent({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const onboarding = user?.user_metadata?.admin_tenant_onboarding === true;
  const [link, setLink] = useState(() => parseInvitationLink(window.location.search, window.location.hash));
  const [failure, setFailure] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState<string | null>(null);
  const sessionKey = `${userId ?? ''}:${location.pathname}:${location.search}`;
  const message = link.kind === 'error' ? link.message : failure;
  useToastMessage(message);
  useEffect(() => {
    const inspect = () => { setFailure(null); setLink(parseInvitationLink(window.location.search, window.location.hash)); };
    window.addEventListener('hashchange', inspect);
    window.addEventListener('popstate', inspect);
    return () => { window.removeEventListener('hashchange', inspect); window.removeEventListener('popstate', inspect); };
  }, []);
  useEffect(() => {
    let active = true;
    async function capture() {
      if (link.kind === 'none' || link.kind === 'error') return;
      try {
        // Await the SDK's automatic URL processing before attempting explicit capture.
        await captureInvitationSession(link, supabase.auth, () => active);
        if (!active) return;
        setLink({ kind: 'none' });
        // Active users receiving a sign-in notification do not reset their password.
        // PendingInvitationGate still checks the database for pending magic-link users.
        const passwordRequired = link.type ? link.type === 'invite' || link.type === 'recovery'
          : link.kind !== 'tokens' || link.invitation === true;
        navigate(invitationLanding(location.search, passwordRequired), { replace: true });
      } catch (error: unknown) {
        if (!active) return;
        const expired = error && typeof error === 'object' && 'code' in error && error.code === 'otp_expired';
        setFailure(expired ? expiredInvitationMessage : 'No se pudo verificar el enlace de acceso. Solicita una nueva invitación.');
      }
    }
    void capture();
    return () => { active = false; };
  }, [link, location.search, navigate]);
  useEffect(() => {
    if (!userId || link.kind !== 'none' || location.pathname.startsWith('/panel/')) return;
    let active = true;
    async function routeSession() {
      try {
        const destination = invitationLanding(location.search);
        const institution = new URL(destination, window.location.origin).searchParams.get('institution');
        if (!institution) return;
        const { data, error } = await supabase.rpc('admin_tenant_own_invitation', { target_institution_id: institution });
        const pending: unknown = data;
        if (active && (onboarding || (!error && pending && typeof pending === 'object' && 'pending' in pending && pending.pending === true))) navigate(destination, { replace: true });
      } catch { /* The normal login remains available when no invitation can be verified. */ }
      finally { if (active) setSessionChecked(sessionKey); }
    }
    void routeSession();
    return () => { active = false; };
  }, [userId, onboarding, link.kind, location.pathname, location.search, navigate, sessionKey]);
  if (message) return <section className={styles.card} role="alert"><h1>Enlace de acceso</h1><p>{message}</p><button type="button" className={styles.submit} onClick={() => {
    setFailure(null); setLink({ kind: 'none' });
    const destination = new URL(invitationLanding(location.search), window.location.origin);
    navigate({ pathname: '/login', search: destination.search, hash: '' }, { replace: true });
  }}>Volver al inicio de sesión</button>
    <RequestInvitationEmail key={location.search} institutionId={new URLSearchParams(location.search).get('institution') ?? new URLSearchParams(location.search).get('institution_id') ?? ''}
      requestEmail={(email, institutionId) => requestInvitationEmailService(supabase, email, institutionId)} />
  </section>;
  if (link.kind !== 'none') return <p className={styles.card} role="status" aria-busy="true">Verificando el enlace de acceso…</p>;
  if (userId && !location.pathname.startsWith('/panel/') && sessionChecked !== sessionKey) return <p className={styles.card} role="status">Verificando tu acceso institucional…</p>;
  return children;
}
