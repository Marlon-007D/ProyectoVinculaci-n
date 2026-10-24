import { ToastBoundary, useToastMessage } from '../auth/Toast/Toast';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AccessRequestService } from './membershipRequestService';
import styles from './MembershipRequestPanel.module.css';

type RequestState = { status: 'loading' } | { status: 'ready'; error?: string } | { status: 'submitting' }
  | { status: 'pending' } | { status: 'approved' } | { status: 'error'; message: string };

interface Props { institution: string; slug?: string; service: AccessRequestService; onContinue: () => void }

export function MembershipRequestPanel(props: Props) {
  return <ToastBoundary><MembershipRequestPanelContent {...props} /></ToastBoundary>;
}

function MembershipRequestPanelContent({ institution, slug, service, onContinue }: Props) {
  const [state, setState] = useState<RequestState>({ status: 'loading' });
  const requestError = state.status === 'ready' ? state.error : undefined;
  useToastMessage(state.status === 'error' ? state.message : requestError);
  const [revision, setRevision] = useState(0);
  const submitting = useRef(false);
  const draft = useRef({ firstName: '', lastName: '', phone: '' });
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void service.get(institution, slug).then(request => {
      if (active) setState(request ? { status: request.status } : { status: 'ready' });
    }).catch(() => { if (active) setState({ status: 'error', message: 'No se pudo consultar tu solicitud. Intenta nuevamente.' }); });
    return () => { active = false; };
  }, [institution, slug, service, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || state.status !== 'ready') return;
    const data = new FormData(event.currentTarget);
    draft.current = { firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(), phone: String(data.get('phone')).trim() };
    submitting.current = true;
    setState({ status: 'submitting' });
    try {
      await service.submit({ institution, slug, ...draft.current });
      setState({ status: 'pending' });
    } catch (error) {
      setState({ status: 'ready', error: error instanceof Error ? error.message : 'No se pudo enviar la solicitud.' });
    } finally { submitting.current = false; }
  }

  function content() {
    switch (state.status) {
      case 'loading': return <p role="status">Consultando tu solicitud…</p>;
      case 'submitting': return <p role="status" aria-busy="true">Enviando solicitud…</p>;
      case 'pending': return <><p role="status">Pendiente de aprobación. Tu institución debe asignarte un rol antes de habilitar tu acceso.</p><button type="button" onClick={() => setRevision(value => value + 1)}>Consultar estado</button></>;
      case 'approved': return <><p role="status">Tu solicitud fue aprobada.</p><button type="button" onClick={onContinue}>Continuar al panel</button></>;
      case 'error': return <><button type="button" onClick={() => setRevision(value => value + 1)}>Volver a intentar</button></>;
      case 'ready': return <form onSubmit={submit} className={styles.form}>
        <label>Nombres<input name="firstName" defaultValue={draft.current.firstName} autoComplete="given-name" maxLength={100} required /></label>
        <label>Apellidos<input name="lastName" defaultValue={draft.current.lastName} autoComplete="family-name" maxLength={100} required /></label>
        <label>Celular<input name="phone" defaultValue={draft.current.phone} type="tel" autoComplete="tel-national" inputMode="numeric" pattern="09[0-9]{8}" maxLength={10} title="Celular ecuatoriano de 10 dígitos que empiece con 09" required /></label>
        <button type="submit">Enviar solicitud</button>
      </form>;
      default: { const exhaustive: never = state; return exhaustive; }
    }
  }
  return <section className={styles.panel} aria-labelledby="request-access-title"><h2 id="request-access-title">Solicitud de acceso</h2>{content()}</section>;
}
