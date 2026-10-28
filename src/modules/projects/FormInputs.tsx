import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Field, fieldProps } from './FormField';
import { MONEY_TRIM_MESSAGES, sanitizeMoneyInput } from './projectValidation';
import { createTransientNotice } from './transientNotice';

interface TextFieldProps {
  id: string;
  name: string;
  label: ReactNode;
  max: number;
  defaultValue?: string;
  error?: string;
  hint?: ReactNode;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
  list?: string;
  className?: string;
  onEdit?: (name: string) => void;
}

/** Text input with maxLength and a visible «45/80» counter. Existing longer values show the counter in red. */
export function TextField({ id, name, label, max, defaultValue = '', error, hint, textarea, rows, placeholder, list, className, onEdit }: TextFieldProps) {
  const [count, setCount] = useState(defaultValue.length);
  const change = (value: string) => { setCount(value.length); onEdit?.(name); };
  return <Field id={id} label={label} error={error} hint={hint} count={count} max={max} className={className}>
    {textarea
      ? <textarea {...fieldProps(id, error, Boolean(hint))} name={name} defaultValue={defaultValue} maxLength={max} rows={rows} placeholder={placeholder} onChange={event => change(event.target.value)} />
      : <input {...fieldProps(id, error, Boolean(hint))} name={name} defaultValue={defaultValue} maxLength={max} placeholder={placeholder} list={list} onChange={event => change(event.target.value)} />}
  </Field>;
}

interface MoneyFieldProps {
  id: string;
  name: string;
  label: ReactNode;
  defaultValue?: number | string;
  error?: string;
  hint?: ReactNode;
  warning?: boolean;
  className?: string;
  onEdit?: (name: string) => void;
  onValue?: (text: string) => void;
}

/** «350.2» from the database is shown as «350,20». */
export const moneyText = (value?: number | string) => value === undefined || value === '' ? ''
  : typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(2)).replace('.', ',') : value;

/**
 * Amount input as text («350,20»): the browser shows no bubble of its own and the error appears under the field.
 * Typing or pasting more than 2 decimals, 10 integer digits, a sign or letters is blocked and explained with a
 * temporary notice (3 s; a valid character or leaving the field clears it). `error` is the submit validation
 * error: the trim never sets it, and it stays until the parent clears it through `onEdit`.
 */
export function MoneyField({ id, name, label, defaultValue, error, hint, warning, className, onEdit, onValue }: MoneyFieldProps) {
  const [value, setValue] = useState(() => moneyText(defaultValue));
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof createTransientNotice> | undefined>(undefined);
  timer.current ??= createTransientNotice(setNotice);
  useEffect(() => () => timer.current?.dispose(), []);
  function change(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value;
    const caret = event.target.selectionStart ?? typed.length;
    const { text, trimmed } = sanitizeMoneyInput(typed);
    setValue(text);
    if (trimmed) timer.current?.show(MONEY_TRIM_MESSAGES[trimmed]); else timer.current?.clear();
    onEdit?.(name);
    onValue?.(text);
    if (text !== typed) {
      // Keep the caret where the user was typing, minus the characters that were removed before it.
      const position = Math.max(0, Math.min(text.length, caret - (typed.length - text.length)));
      requestAnimationFrame(() => input.current?.setSelectionRange(position, position));
    }
  }
  return <Field id={id} label={label} error={error} notice={notice} hint={hint} warning={warning} className={className}>
    <input ref={input} {...fieldProps(id, error, Boolean(hint), Boolean(notice))} name={name} type="text" inputMode="decimal" autoComplete="off" placeholder="0,00"
      value={value} onChange={change} onBlur={() => timer.current?.clear()} />
  </Field>;
}
