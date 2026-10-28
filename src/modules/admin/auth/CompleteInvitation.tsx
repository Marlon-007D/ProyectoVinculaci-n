import { AdminForm } from './AdminForm';
import { useState, type FormEvent } from 'react';
import { useToast } from './Toast/Toast';
import styles from './CompleteInvitation.module.css';
import { PasswordField } from './PasswordField';
import { invitationPasswordIssue } from './completeInvitationAccount';
import type { InvitationDetails } from './invitationAccount';

export function CompleteInvitation({ institutionName, details, complete }: { institutionName: string; details: InvitationDetails; complete: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const notify = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = invitationPasswordIssue(password, confirmation);
    setIssue(validation);
    if (validation) { notify(validation, 'warning'); return; }
    setBusy(true);
    try { await complete(password); notify('Contraseña guardada y acceso activado correctamente.', 'success'); }
    catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'No se pudo completar el acceso. Revisa tu conexión e inténtalo nuevamente.';
      setIssue(message);
      notify(message);
    }
    finally { setBusy(false); }
  }
  return <section className={styles.card}><h2>Completar mi cuenta</h2><p>{institutionName}</p><AdminForm className={styles.form} onSubmit={submit} aria-busy={busy}>
    <div className={styles.details}>
      <label>Correo<input type="email" autoComplete="email" value={details.email} readOnly /></label>
      <label>Nombres<input autoComplete="given-name" value={details.firstName} readOnly /></label>
      <label>Apellidos<input autoComplete="family-name" value={details.lastName} readOnly /></label>
      <label>Celular<input type="tel" autoComplete="tel-national" value={details.phone} readOnly /></label>
    </div>
    <PasswordField label="Nueva contraseña" autoComplete="new-password" minLength={6} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
    <PasswordField label="Confirmar contraseña" autoComplete="new-password" minLength={6} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
    <p>La contraseña debe tener al menos 6 caracteres.</p>
    {issue && <p role="alert">{issue}</p>}
    <button className={styles.submit} type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y continuar'}</button>
  </AdminForm></section>;
}
