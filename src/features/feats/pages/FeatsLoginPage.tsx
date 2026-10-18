import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import type { FeatsAuthService } from '../services/authService'
import { AdminCoursesWorkspace } from './AdminCoursesWorkspace'
import styles from './FeatsLoginPage.module.css'

interface Props { authService: FeatsAuthService }

export function FeatsLoginPage({ authService }: Props) {
  const [hasEntered, setHasEntered] = useState(() => authService.hasSession())
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
      setError('Completa el correo y la clave.')
      return
    }

    const signedIn = await authService.signIn({ email, password }, remember)
    if (!signedIn) {
      setError('El correo o la clave no son correctos.')
      return
    }

    setError('')
    setHasEntered(true)
  }

  const handleLogout = () => {
    authService.signOut()
    setHasEntered(false)
  }

  if (hasEntered) return <AdminCoursesWorkspace onLogout={handleLogout} />

  return (
    <main className={styles.page}>
      <section className={styles.login} aria-labelledby="feats-login-title">
        <div className={styles.mark} aria-hidden="true"><KeyRound size={22} strokeWidth={1.7} /></div>
        <h1 id="feats-login-title" className={styles.title}>Iniciar sesión</h1>
        <p className={styles.subtitle}>Ingresa tus datos para continuar</p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="admin-email">Correo electrónico</label>
            <span className={styles.inputWrap}>
              <Mail size={18} aria-hidden="true" />
              <input id="admin-email" name="email" type="email" autoComplete="username" placeholder="nombre@ejemplo.com" aria-invalid={Boolean(error)} aria-describedby={error ? 'admin-login-error' : undefined} required />
            </span>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-password">Clave</label>
            <span className={styles.inputWrap}>
              <KeyRound size={18} aria-hidden="true" />
              <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu clave" aria-invalid={Boolean(error)} aria-describedby={error ? 'admin-login-error' : undefined} required />
              <button className={styles.visibility} type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </div>
          <label className={styles.remember}>
            <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
            <span>Recuérdame</span>
          </label>
          {error && <p id="admin-login-error" className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit">Login</button>
        </form>
      </section>
    </main>
  )
}
