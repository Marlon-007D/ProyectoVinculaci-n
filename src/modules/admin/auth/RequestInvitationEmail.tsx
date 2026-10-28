import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AdminForm } from './AdminForm';
import { useToast } from './Toast/Toast';
import styles from './CompleteInvitation.module.css';

export interface InvitationEmailResult { accepted?: boolean; retryAfter?: number; error?: string; rateLimited?: boolean }
type RequestState = { status: 'idle' } | { status: 'sending' } | { status: 'cooldown'; until: number };

export function RequestInvitationEmail({ institutionId, requestEmail }: {
  institutionId: string; requestEmail: (email: string, institutionId: string) => Promise<InvitationEmailResult>;
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<RequestState>({ status: 'idle' });
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const notify = useToast();
  useEffect(() => {
    if (state.status !== 'cooldown') return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= state.until) setState({ status: 'idle' });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || state.status !== 'idle') return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { notify('Por favor, ingresa un correo electrónico válido.', 'warning'); return; }
    inFlight.current = true;
    setState({ status: 'sending' });
    try {
      const result = await requestEmail(email.trim().toLowerCase(), institutionId);
      const seconds = Math.min(3600, Math.max(1, result.retryAfter ?? 60));
      const current = Date.now();
      setNow(current);
      setState({ status: 'cooldown', until: current + seconds * 1000 });
      if (result.rateLimited) notify('Por seguridad, espera unos segundos antes de solicitar un nuevo envío.', 'warning');
      else if (result.accepted) notify('Se ha enviado un nuevo enlace a tu correo electrónico.', 'success');
      else notify(result.error ?? 'No se pudo solicitar el correo. Inténtalo más tarde.');
    } catch {
      const current = Date.now();
      setNow(current);
      setState({ status: 'cooldown', until: current + 60000 });
      notify('No se pudo solicitar el correo. Revisa la conexión e inténtalo más tarde.');
    } finally { inFlight.current = false; }
  }
  const seconds = state.status === 'cooldown' ? Math.max(0, Math.ceil((state.until - now) / 1000)) : 0;
  return <AdminForm className={styles.form} onSubmit={submit} aria-busy={state.status === 'sending'}>
    <p>Ingresa el correo al que recibiste la invitación. Si tienes un acceso pendiente en esta institución, recibirás un nuevo enlace.</p>
    <div className={styles.details}><label>Correo electrónico<input type="email" autoComplete="email" required value={email}
      disabled={state.status !== 'idle'} onChange={event => setEmail(event.target.value)} /></label></div>
    <button type="submit" className={styles.secondary} disabled={!institutionId || state.status !== 'idle'}>
      {state.status === 'sending' ? 'Solicitando correo…' : seconds ? `Solicitar nuevo correo en ${seconds} s` : 'Solicitar nuevo correo de acceso'}
    </button>
    {!institutionId && <p>Vuelve a abrir el enlace institucional o solicita un nuevo acceso al administrador de tu plantel.</p>}
    {seconds > 0 && <p role="status">Podrás solicitar otro correo en {seconds} segundos.</p>}
  </AdminForm>;
}
