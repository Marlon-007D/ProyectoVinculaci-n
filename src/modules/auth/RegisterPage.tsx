import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { registrationReducer, type RegistrationService, type RegistrationInput } from './registration.types';
import { registrationError } from '../../core/auth/registrationFlow';
import styles from './RegisterPage.module.css';

export function RegisterPage({ service }: { service: RegistrationService }) {
  const [state, dispatch] = useReducer(registrationReducer, { status: 'loading' });
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (state.status !== 'loading') return;
    let active = true;
    void service.listInstitutions().then(institutions => { if (active) dispatch({ type: 'loaded', institutions }); })
      .catch(async error => { const failure = await registrationError(error); if (active) dispatch({ type: 'loadFailed', message: failure.message }); });
    return () => { active = false; };
  }, [service, state.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'ready' || !state.institutions.length || submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: RegistrationInput = {
      firstName: String(data.get('firstName') ?? '').trim(), lastName: String(data.get('lastName') ?? '').trim(),
      email: String(data.get('email') ?? '').trim().toLowerCase(), password: String(data.get('password') ?? ''), institutionId: String(data.get('institutionId') ?? ''),
    };
    if (!input.firstName || !input.lastName || !state.institutions.some(item => item.institution_id === input.institutionId)) return;
    submitting.current = true;
    dispatch({ type: 'submit' });
    try { await service.register(input); form.reset(); setShowPassword(false); dispatch({ type: 'succeeded' }); }
    catch (error) { dispatch({ type: 'failed', message: (await registrationError(error)).message }); }
    finally { submitting.current = false; }
  }

  function content() {
    switch (state.status) {
      case 'loading': return <p role="status">Cargando unidades educativas.</p>;
      case 'loadError': return <div><p className={styles.error} role="alert">{state.message ?? 'No se pudieron cargar las unidades educativas. Inténtalo de nuevo.'}</p><button className={styles.secondary} onClick={() => dispatch({ type: 'retry' })}>Volver a intentar</button></div>;
      case 'success': return <div className={styles.success} role="status"><p>Solicitud enviada con éxito. Tu cuenta ha sido registrada y está a la espera de la aprobación del Administrador de tu Unidad Educativa.</p><Link to="/portal">Volver al portal público</Link></div>;
      case 'ready':
      case 'submitting': {
        const busy = state.status === 'submitting';
        return <form className={styles.form} onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy || !state.institutions.length} className={styles.fields}>
            <div className={styles.names}><label>Nombres<input name="firstName" autoComplete="given-name" required maxLength={100} pattern=".*\S.*" /></label><label>Apellidos<input name="lastName" autoComplete="family-name" required maxLength={100} pattern=".*\S.*" /></label></div>
            <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="nombre@institucion.edu.ec" required maxLength={254} /></label>
            <label>Contraseña<span className={styles.password}><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="register-password-help" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span><small id="register-password-help">Usa al menos 12 caracteres.</small></label>
            <label>Unidad educativa<select name="institutionId" defaultValue="" required><option value="" disabled>Selecciona tu unidad educativa</option>{state.institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}</select></label>
            <p className={styles.help}>Un administrador deberá aprobar tu membresía y asignar los permisos correspondientes.</p>
            <button className={styles.submit} type="submit">{busy ? 'Registrando cuenta.' : 'Crear cuenta'}</button>
          </fieldset>
          {!state.institutions.length && <p role="status">No hay unidades educativas disponibles para el registro.</p>}
          {state.status === 'ready' && state.error && <p className={styles.error} role="alert">{state.error}</p>}
        </form>;
      }
      default: { const exhaustive: never = state; return exhaustive; }
    }
  }
  return <main className={styles.page}><section className={styles.card} aria-labelledby="register-title"><Link className={styles.back} to="/panel/admin"><ArrowLeft size={16} aria-hidden="true" />Volver al ingreso</Link><span className={styles.mark}><GraduationCap size={25} aria-hidden="true" /></span><h1 id="register-title">Registro institucional</h1><p className={styles.intro}>Crea tu cuenta y solicita acceso a tu unidad educativa.</p>{content()}</section></main>;
}
