import type { ReactNode } from 'react';
import { ArrowLeft, Building2, Compass, House, LogIn, PlugZap, RotateCw, TriangleAlert, UserX, type LucideIcon } from 'lucide-react';
import styles from './ErrorPage.module.css';

export type ErrorKind = 'not-found' | 'unexpected' | 'module' | 'session' | 'institution';

const content: Record<ErrorKind, { code: string; Icon: LucideIcon; title: string; message: string }> = {
  'not-found': {
    code: '404', Icon: Compass, title: 'No encontramos esta página',
    message: 'La dirección pudo haber cambiado o ya no está disponible. Revisa el enlace o vuelve al inicio.',
  },
  unexpected: {
    code: 'Error', Icon: TriangleAlert, title: 'Algo salió mal',
    message: 'Ocurrió un problema inesperado al mostrar esta pantalla. La información que ya guardaste no se ha perdido.',
  },
  session: {
    code: 'Sesión', Icon: UserX, title: 'Tu sesión terminó',
    message: 'Cerraste sesión o expiró. Vuelve al inicio de tu institución o inicia sesión de nuevo para continuar.',
  },
  institution: {
    code: 'Institución', Icon: Building2, title: 'Institución no disponible',
    message: 'No pudimos identificar una institución activa para tu cuenta. Vuelve al inicio o inicia sesión de nuevo.',
  },
  module: {
    code: 'Módulo', Icon: PlugZap, title: 'No se pudo abrir el módulo',
    message: 'Revisa tu conexión y vuelve a intentarlo. Si el problema continúa, solicita que revisen su configuración.',
  },
};

interface Props {
  kind: ErrorKind;
  /** Where "Ir al inicio" leads; a plain link so it also works outside the router. */
  homeHref?: string;
  /** Adds an "Iniciar sesión" action; used when the session or the institution is missing. */
  loginHref?: string;
  onRetry?: () => void;
  /** Inside a page layout (header and footer) instead of filling the viewport. */
  embedded?: boolean;
  children?: ReactNode;
}

export function ErrorPage({ kind, homeHref = '/', loginHref, onRetry, embedded = false, children }: Props) {
  const { code, Icon, title, message } = content[kind];
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  // Embedded pages already sit inside the layout's <main>.
  const Container = embedded ? 'div' : 'main';
  return <Container className={`${styles.page} ${embedded ? styles.embedded : ''}`} aria-labelledby="error-page-title">
    <section className={styles.card}>
      <span className={styles.code} aria-hidden="true">{code}</span>
      <span className={styles.icon} aria-hidden="true"><Icon size={30} strokeWidth={1.8} /></span>
      <h1 id="error-page-title" className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      {children}
      <div className={styles.actions}>
        {onRetry && <button type="button" className={styles.primary} onClick={onRetry}><RotateCw size={17} aria-hidden="true" />Reintentar</button>}
        <a className={onRetry ? styles.secondary : styles.primary} href={homeHref}><House size={17} aria-hidden="true" />Ir al inicio</a>
        {loginHref && <a className={styles.secondary} href={loginHref}><LogIn size={17} aria-hidden="true" />Iniciar sesión</a>}
        {canGoBack && <button type="button" className={styles.secondary} onClick={() => window.history.back()}><ArrowLeft size={17} aria-hidden="true" />Volver</button>}
      </div>
      <p className={styles.help}>Si necesitas ayuda, comunícate con el administrador de tu institución.</p>
    </section>
  </Container>;
}
