import { useEffect, useState, type ReactNode } from 'react';
import { PrivateContentSkeleton } from '../../site/components/Layout/PrivateContentSkeleton';
import { useAuth } from '../../../core/AuthContext';
import { supabase } from '../../../core/supabaseClient';
import { resumePasswordSession } from './temporaryPasswordSession';
import { useToastMessage } from './Toast/Toast';

export function AdminSessionPolicy({ children }: { children: ReactNode }) {
  const { user, loading, mfaRequired, mfaEnrollmentRequired } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = Boolean(user && (mfaRequired || mfaEnrollmentRequired));
  useToastMessage(failure);
  useEffect(() => {
    if (!pending || loading) return;
    let active = true;
    async function resume() {
      try {
        await resumePasswordSession(() => supabase.auth.refreshSession(), window.sessionStorage);
      } catch {
        if (active) setFailure('No se pudo actualizar la sesión. Revisa la conexión y vuelve a intentarlo.');
      }
    }
    void resume();
    return () => { active = false; };
  }, [pending, loading, user?.id, attempt]);
  if (!pending) return children;
  if (failure) return <section role="alert"><p>{failure}</p><button type="button" onClick={() => { setFailure(null); setAttempt(value => value + 1); }}>Reintentar</button></section>;
  return <PrivateContentSkeleton label="Actualizando la sesión administrativa" />;
}
