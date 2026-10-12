import React, { useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import styles from './MfaEnrollment.module.css';

export const MfaEnrollment: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleStartEnroll = async () => {
    setMessage('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
  };

  const handleVerifyEnroll = async () => {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setMessage(`Error en reto: ${challenge.error.message}`);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });

    if (verify.error) {
      setMessage(`Código incorrecto: ${verify.error.message}`);
    } else {
      setMessage('¡Autenticación de Dos Factores (MFA) activada correctamente!');
      setQrCode(null);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Seguridad: Autenticación de Dos Factores (MFA)</h2>
      {!qrCode ? (
        <button onClick={handleStartEnroll} className={styles.btnPrimary}>
          Configurar Aplicación Autenticadora
        </button>
      ) : (
        <div className={styles.qrSection}>
          <p>Escanea el código QR con tu aplicación (Google Authenticator / Authy):</p>
          <img src={qrCode} alt="Código QR MFA" className={styles.qrImage} />
          <input
            type="text"
            placeholder="Ingresa el código de 6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={styles.input}
          />
          <button onClick={handleVerifyEnroll} className={styles.btnPrimary}>
            Verificar y Habilitar
          </button>
        </div>
      )}
      {message && <p className={styles.statusMsg}>{message}</p>}
    </div>
  );
};