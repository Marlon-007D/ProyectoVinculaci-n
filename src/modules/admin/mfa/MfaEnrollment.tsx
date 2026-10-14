import React, { useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import styles from './MfaEnrollment.module.css';

export const MfaEnrollment: React.FC<{ onEnrolled: () => void }> = ({ onEnrolled }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState('');
  const [hasExistingFactor, setHasExistingFactor] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleStartEnroll = async () => {
    setMessage('');
    setBusy(true);
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setBusy(false);
      setMessage(`No se pudieron consultar los factores de tu cuenta: ${factorsError.message}`);
      return;
    }
    const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified');
    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
      setHasExistingFactor(true);
      setQrCode('existing-factor');
      setBusy(false);
      return;
    }
    for (const factor of factors.totp.filter((item) => item.status !== 'verified')) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) {
        setBusy(false);
        setMessage(`No se pudo reiniciar el enrolamiento pendiente: ${unenrollError.message}`);
        return;
      }
    }
    // Unique name prevents collisions with abandoned factors that used an empty name.
    const friendlyName = `Portal institucional ${Date.now()}`;
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
    setBusy(false);
    if (error) {
      setMessage(`Supabase rechazó la configuración: ${error.message}`);
      return;
    }
    setHasExistingFactor(false);
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
  };

  const handleVerifyEnroll = async () => {
    setBusy(true);
    setMessage('');
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setBusy(false);
      setMessage('No se pudo iniciar la verificación. Inténtalo de nuevo.');
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) {
      setBusy(false);
      setMessage('El código no es válido o venció. Revisa tu aplicación e inténtalo de nuevo.');
      return;
    }
    const { error: saveError } = await supabase.rpc('complete_own_mfa_enrollment');
    setBusy(false);
    if (saveError) {
      setMessage(`Se verificó el código, pero no se pudo guardar el estado de seguridad: ${saveError.message}. Ejecuta la versión actualizada de database/superadmin.sql.`);
      return;
    }
    setMessage('Verificación en dos pasos activada.');
    setQrCode(null);
    onEnrolled();
  };

  return (
    <main className="grid min-h-[80vh] place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[480px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white">V</div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#245b88]">PROTECCIÓN DE LA CUENTA</p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink">Activa la verificación en dos pasos</h1>
        <p className="mb-5 text-sm leading-relaxed text-muted">Tu cuenta recibió un rol institucional. Configura una aplicación autenticadora antes de continuar; la necesitarás al iniciar sesión.</p>
        <p className="mb-5 -mt-4 text-xs leading-relaxed text-muted">Los códigos TOTP se actualizan automáticamente cada 30 segundos. Ese intervalo estándar no se puede reducir a 15 segundos desde el portal.</p>
        {!qrCode ? (
          <button type="button" onClick={() => void handleStartEnroll()} disabled={busy} className={styles.btnPrimary}>
            {busy ? 'Preparando…' : 'Configurar aplicación autenticadora'}
          </button>
        ) : (
          <div className={styles.qrSection}>
            {!hasExistingFactor && <button type="button" onClick={() => void handleStartEnroll()} disabled={busy} className={styles.btnSecondary}>
              Regenerar código QR
            </button>}
            <p>{hasExistingFactor ? 'Ya hay una aplicación autenticadora vinculada. Confirma que la controlas con el código temporal.' : 'Escanea el código QR con Google Authenticator, Microsoft Authenticator o una aplicación compatible. Luego escribe el código de seis dígitos.'}</p>
            {!hasExistingFactor && <img src={qrCode} alt="Código QR para configurar la aplicación autenticadora" className={styles.qrImage} />}
            <input type="text" aria-label="Código de seis dígitos" placeholder="000000" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={styles.input} />
            <button type="button" onClick={() => void handleVerifyEnroll()} disabled={busy || code.length !== 6} className={styles.btnPrimary}>
              {busy ? 'Verificando…' : 'Verificar y continuar'}
            </button>
          </div>
        )}
        {message && <p role="status" className={styles.statusMsg}>{message}</p>}
      </section>
    </main>
  );
};
