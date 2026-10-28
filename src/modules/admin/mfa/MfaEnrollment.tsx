import { AdminForm } from '../auth/AdminForm';
import { useToastMessage, useToast } from '../auth/Toast/Toast';
import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../../../core/supabaseClient';
import styles from './MfaEnrollment.module.css';

type Props = { onEnrolled: () => void };

export const MfaEnrollment: React.FC<Props> = ({ onEnrolled }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [existingFactor, setExistingFactor] = useState(false);
  const [verifiedButNotSaved, setVerifiedButNotSaved] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const notify = useToast();
  useToastMessage(message);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const beginEnrollment = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw new Error('No se pudieron consultar los factores de seguridad. Inténtalo de nuevo.');

      const verified = factors.totp.find((factor) => factor.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setExistingFactor(true);
        setQrCode(null);
        setSecret('');
        setVerifiedButNotSaved(false);
        return;
      }

      for (const pending of factors.totp.filter((factor) => factor.status !== 'verified')) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
        if (error) throw new Error('No se pudo reiniciar la configuración pendiente. Inténtalo otra vez.');
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Portal institucional ${Date.now()}`,
      });
      if (error) throw new Error('No se pudo crear el enrolamiento. Inténtalo de nuevo.');
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setExistingFactor(false);
      setVerifiedButNotSaved(false);
      setCode('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ocurrió un error al preparar la autenticación.');
    } finally {
      setBusy(false);
    }
  };

  const persistEnrollment = async () => {
    const { error } = await supabase.rpc('complete_own_mfa_enrollment');
    if (error) {
      setVerifiedButNotSaved(true);
      setMessage('El código se verificó. No se pudo guardar el estado de seguridad; revisa que la migración MFA esté aplicada y vuelve a intentar guardar.');
      return false;
    }
    notify('Autenticación en dos pasos activada correctamente.', 'success');
    onEnrolled();
    return true;
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verifiedButNotSaved) {
      setBusy(true);
      setMessage('');
      try {
        await persistEnrollment();
      } catch {
        setMessage('No se pudo guardar la configuración de seguridad. Inténtalo de nuevo.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw new Error('No se pudo iniciar la verificación. Inténtalo de nuevo.');
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (error) throw new Error('El código no es válido o venció. Revisa tu autenticador e inténtalo de nuevo.');
      setVerifiedButNotSaved(true);
      await persistEnrollment();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo verificar el código.');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage('No se pudo copiar la clave. Puedes seleccionarla y copiarla manualmente.');
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="mfa-title">
        <div className={styles.brandMark} aria-hidden="true"><ShieldCheck size={24} /></div>
        <p className={styles.eyebrow}>SEGURIDAD DE LA CUENTA</p>
        <h1 id="mfa-title">Configura la verificación en dos pasos</h1>
        <p className={styles.intro}>Vincula una aplicación autenticadora para proteger el acceso a tu cuenta institucional.</p>

        <div className={styles.steps} aria-label="Pasos de configuración">
          <span className={`${styles.step} ${qrCode || existingFactor ? styles.stepActive : ''}`}><b>1</b> Vincular aplicación</span>
          <span className={`${styles.step} ${code || verifiedButNotSaved ? styles.stepActive : ''}`}><b>2</b> Verificar código</span>
        </div>

        {!qrCode && !existingFactor && !verifiedButNotSaved && (
          <div className={styles.setupIntro}>
            <div className={styles.iconTile}><Smartphone size={21} /></div>
            <div><h2>Prepara tu autenticador</h2><p>Google Authenticator, Microsoft Authenticator, Authy u otra app compatible con TOTP.</p></div>
            <button type="button" onClick={() => void beginEnrollment()} disabled={busy} className={styles.primaryButton}>
              {busy ? 'Preparando…' : 'Comenzar configuración'}
            </button>
          </div>
        )}

        {(qrCode || existingFactor || verifiedButNotSaved) && (
          <AdminForm className={styles.form} onSubmit={(event) => void verifyCode(event)}>
            {qrCode && !verifiedButNotSaved && <>
              <div className={styles.instruction}><span>1</span><div><strong>Escanea el código QR</strong><p>Abre tu app autenticadora y agrega una cuenta escaneando este código.</p></div></div>
              <div className={styles.qrFrame}><img src={qrCode} alt="Código QR para vincular una aplicación autenticadora" /></div>
              <details className={styles.manualSetup}>
                <summary><KeyRound size={16} /> ¿No puedes escanearlo? Usa una clave</summary>
                <p>En la aplicación, elige introducir una clave de configuración manualmente.</p>
                <div className={styles.secretRow}>
                  <code>{showSecret ? secret : '•'.repeat(Math.min(secret.length, 28))}</code>
                  <button type="button" className={styles.iconButton} onClick={() => setShowSecret((visible) => !visible)} aria-label={showSecret ? 'Ocultar clave' : 'Mostrar clave'}>{showSecret ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  <button type="button" className={styles.iconButton} onClick={() => void copySecret()} aria-label="Copiar clave de configuración">{copied ? <Check size={17} /> : <Copy size={17} />}</button>
                </div>
                <small>{copied ? 'Clave copiada' : 'Mantén esta clave privada. No la compartas.'}</small>
              </details>
            </>}

            {existingFactor && <div className={styles.notice}><LockKeyhole size={18} /><p>Ya existe una aplicación autenticadora vinculada. Ingresa el código temporal para confirmar que tienes acceso.</p></div>}
            {verifiedButNotSaved && <div className={styles.notice}><Check size={18} /><p>El autenticador ya fue verificado. Guarda el estado de seguridad para continuar.</p></div>}

            {!verifiedButNotSaved && <>
              <div className={styles.instruction}><span>2</span><div><strong>Escribe el código de seis dígitos</strong><p>El código cambia automáticamente cada 30 segundos.</p></div></div>
              <label className={styles.codeLabel} htmlFor="mfa-code">Código de verificación</label>
              <input id="mfa-code" className={styles.codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} aria-describedby="mfa-code-help" />
              <span id="mfa-code-help" className={styles.helper}>Solo números, sin espacios.</span>
            </>}

            <button type="submit" disabled={busy} className={styles.primaryButton}>
              {busy ? 'Verificando…' : verifiedButNotSaved ? 'Guardar y continuar' : 'Verificar y activar'}
            </button>
            {qrCode && !verifiedButNotSaved && <button type="button" disabled={busy} className={styles.textButton} onClick={() => void beginEnrollment()}>Generar un nuevo código QR</button>}
          </AdminForm>
        )}

        <p className={styles.privacy}><LockKeyhole size={14} /> Tu clave de configuración se muestra solo en esta sesión y no se guarda en el navegador.</p>
      </section>
    </main>
  );
};
