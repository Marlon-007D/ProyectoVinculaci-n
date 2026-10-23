import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../core/supabaseClient';
import { useAuth } from '../../core/AuthContext';
import styles from './PendingAccessRoute.module.css';
interface PublicInstitution { institution_id: string; name: string; slug: string }
type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; institutions: PublicInstitution[] };
export function PendingAccessRoute() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void supabase.rpc('own_pending_institutions').then(({ data, error }) => {
      if (active) setState(error ? { status: 'error' } : { status: 'ready', institutions: data ?? [] });
    }, () => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [user?.id]);
  function content() {
    switch (state.status) {
      case 'loading': return <p role="status">Consultando tu solicitud.</p>;
      case 'error': return <p role="alert">No se pudo consultar tu solicitud. Vuelve a iniciar sesión e inténtalo de nuevo.</p>;
      case 'ready': return <><p>Tu cuenta no tiene permisos internos. Mientras se revisa tu solicitud, puedes consultar los recursos públicos de tu institución.</p>{state.institutions.map(item => <section key={item.institution_id}><h2>{item.name}</h2><nav aria-label={`Recursos públicos de ${item.name}`}><Link to={`/portal?institution=${encodeURIComponent(item.slug)}`}>Portal público</Link><Link to={`/simuladores?institution=${encodeURIComponent(item.slug)}`}>Simuladores</Link></nav></section>)}</>;
      default: { const exhaustive: never = state; return exhaustive; }
    }
  }
  return <main className={styles.page}><section className={styles.card}><h1>Acceso público institucional</h1>{location.state?.registrationNotice && <p role="status">Cuenta creada correctamente. Tu membresía institucional está pendiente de aprobación.</p>}{content()}<button type="button" onClick={() => void logout()}>Cerrar sesión</button></section></main>;
}
