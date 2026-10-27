import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordField.module.css';

type PasswordFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & { label: string };

export function PasswordField({ label, id, disabled, ...inputProps }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <div className={styles.field}>
    <label htmlFor={inputId}>{label}</label>
    <div className={styles.control}>
      <input {...inputProps} id={inputId} disabled={disabled} type={visible ? 'text' : 'password'} className={styles.input} />
      <button type="button" className={styles.toggle} disabled={disabled} aria-controls={inputId}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} contraseña: ${label}`} aria-pressed={visible}
        onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  </div>;
}
