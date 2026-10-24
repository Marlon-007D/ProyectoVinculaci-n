import { adminDestination } from './auth/institutionNavigation';
import { ToastBoundary, useToastMessage } from './auth/Toast/Toast';
import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import styles from './InstitutionalLogin.module.css';
import { InstitutionalAuthLayout } from '../auth/InstitutionalAuthLayout';

interface Props {
  email: string;
  password: string;
  error: string;
  busy: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
}

type RecoveryState = { status: 'idle' } | { status: 'sending' } | { status: 'sent' } | { status: 'error'; message: string };

function InstitutionalLoginContent({ email, password, error, busy, onEmailChange, onPasswordChange, onSubmit, requestPasswordReset }: Props) {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const search = new URLSearchParams(searchParams);
  if (slug) search.set('slug', slug);
  const registrationPath = adminDestination('/register', search.toString());
  const portalPath = adminDestination('/', search.toString());
  const [showPassword, setShowPassword] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState>({ status: 'idle' });
  useToastMessage(error);
  useToastMessage(recovery.status === 'error' ? recovery.message : null);
  useToastMessage(recovery.status === 'sent' ? 'Si existe la cuenta, recibirás instrucciones para recuperar tu contraseña.' : null, 'success');
  async function recover(form: HTMLFormElement) {
    if (recovery.status === 'sending' || busy) return;
    const emailInput = form.elements.namedItem('email') as HTMLInputElement;
    if (!emailInput.reportValidity()) return;
    setRecovery({ status: 'sending' });
    try {
      const result = await requestPasswordReset(email.trim());
      setRecovery(result.error ? { status: 'error', message: 'No se pudo enviar el correo. Inténtalo de nuevo.' } : { status: 'sent' });
    } catch {
      setRecovery({ status: 'error', message: 'No fue posible conectar. Inténtalo de nuevo.' });
    }
  }
  function recoveryMessage() {
    switch (recovery.status) {
      case 'idle': return null;
      case 'sending': return <p role="status" className={styles.notice}>Enviando solicitud…</p>;
      case 'sent': return null;
      case 'error': return null;
      default: { const exhaustive: never = recovery; return exhaustive; }
    }
  }
  return <InstitutionalAuthLayout labelledBy="institutional-login-title">
      <div className={styles.card}>
        <Link className={styles.back} to={portalPath}><ArrowLeft size={17} aria-hidden="true" />Volver a las instituciones educativas</Link>
        <span className={styles.secure}><ShieldCheck size={14} aria-hidden="true" />Conexión protegida</span>
        <h1 id="institutional-login-title">Ingreso a la Plataforma Institucional</h1>
        <p className={styles.help}>Inicia sesión con tu correo institucional. Te dirigiremos al espacio que corresponde a tu rol.</p>
        <form className={styles.form} onSubmit={onSubmit} aria-busy={busy}>
          <div className={styles.field}><label htmlFor="admin-email">Correo electrónico</label><div className={styles.inputWrap}><Mail size={19} aria-hidden="true" /><input id="admin-email" name="email" type="email" autoComplete="username" placeholder="nombre@institucion.edu.ec" value={email} onChange={e => onEmailChange(e.target.value)} required /></div></div>
          <div className={styles.field}><label htmlFor="admin-password">Contraseña</label><div className={styles.inputWrap}><LockKeyhole size={19} aria-hidden="true" /><input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={e => onPasswordChange(e.target.value)} required /><button type="button" className={styles.visibility} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
          <button type="button" className={styles.recover} disabled={busy || recovery.status === 'sending'} onClick={event => { if (event.currentTarget.form) void recover(event.currentTarget.form); }}>¿Olvidaste tu contraseña? <span>Recuperar por correo</span></button>
          {recoveryMessage()}
          <button type="submit" className={styles.submit} disabled={busy || recovery.status === 'sending'}><span>{busy ? 'Ingresando…' : 'Iniciar sesión'}</span><ArrowRight size={19} aria-hidden="true" /></button>
        </form>
        <p className={styles.register}>¿No tienes una cuenta? <Link to={registrationPath}>Regístrate</Link></p>
      </div>
  </InstitutionalAuthLayout>;
}

export function InstitutionalLogin(props: Props) {
  return <ToastBoundary><InstitutionalLoginContent {...props} /></ToastBoundary>;
}
