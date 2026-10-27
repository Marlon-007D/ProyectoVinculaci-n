import { useEffect, useState } from 'react';
import type { InvitationAccountService, InvitationDetails } from './invitationAccount';
import { CompleteInvitation } from './CompleteInvitation';
import { useToastMessage } from './Toast/Toast';
import styles from './CompleteInvitation.module.css';

type DetailsState = { key: string; status: 'ready'; details: InvitationDetails } | { key: string; status: 'error'; message: string };

export function InvitationAcceptance({ userId, institutionId, slug, institutionName, service, complete }: {
  userId: string; institutionId: string; slug: string; institutionName: string;
  service: InvitationAccountService; complete: (password: string) => Promise<void>;
}) {
  const key = `${userId}:${institutionId}:${slug}`;
  const [state, setState] = useState<DetailsState | null>(null);
  const [revision, setRevision] = useState(0);
  useToastMessage(state?.key === key && state.status === 'error' ? state.message : null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const details = await service.load(userId, institutionId, slug);
        if (active) setState({ key, status: 'ready', details });
      } catch (error: unknown) {
        if (active) setState({ key, status: 'error', message: error instanceof Error ? error.message : 'No se pudo cargar la invitación.' });
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, institutionId, slug, key, service, revision]);
  if (state?.key !== key) return <p className={styles.card} role="status">Verificando los datos de tu invitación…</p>;
  if (state.status === 'error') return <section className={styles.card}><p>{state.message}</p><button type="button" className={styles.submit} onClick={() => { setState(null); setRevision(value => value + 1); }}>Reintentar</button></section>;
  return <CompleteInvitation key={key} details={state.details} institutionName={state.details.institutionName ?? institutionName} complete={complete} />;
}
