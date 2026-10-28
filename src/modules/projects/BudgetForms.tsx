import { useState, type FormEvent } from 'react';
import { moduleClass } from './projectStyles';
import { Field, fieldProps, focusFirstInvalid, useFieldErrors } from './FormField';
import { MoneyField, TextField } from './FormInputs';
import { balanceError, validateBudgetItemForm, validateExpenseForm, validateRoleForm, type Errors, type Validated } from './projectForms';
import { formatMoney } from './projectPresentation';
import { ecuadorToday, parseMoneyInput, TEXT_LIMITS } from './projectValidation';
import type { Expense, MemberOption } from './types';

export type Save = (action: () => Promise<unknown>, message: string) => void;

interface ExpenseFieldsProps {
  prefix: string;
  errors: Errors;
  onEdit: (name: string) => void;
  balance: number;
  start: string;
  end: string;
  defaults?: Pick<Expense, 'description' | 'amount' | 'date'>;
}

/** Concept, amount (with the rubro balance underneath) and date, shared by «Registrar» and «Editar gasto». */
export function ExpenseFields({ prefix, errors, onEdit, balance, start, end, defaults }: ExpenseFieldsProps) {
  const [amount, setAmount] = useState(defaults ? String(defaults.amount) : '');
  const parsed = parseMoneyInput(amount);
  const over = parsed.ok ? balanceError(parsed.value, balance) : '';
  const today = ecuadorToday();
  const last = today < end ? today : end;
  return <>
    <TextField id={`${prefix}-description`} name="description" label="Concepto y referencia del comprobante" max={TEXT_LIMITS.expense} defaultValue={defaults?.description} placeholder="Describe la compra o el servicio" error={errors.description} onEdit={onEdit} />
    <MoneyField id={`${prefix}-amount`} name="amount" label="Importe (USD)" defaultValue={defaults?.amount} error={errors.amount || over}
      hint={`Saldo disponible del rubro: ${formatMoney(balance)}`} warning={balance <= 0}
      onEdit={onEdit} onValue={setAmount} />
    <Field id={`${prefix}-date`} label="Fecha del gasto" error={errors.date}>
      <input {...fieldProps(`${prefix}-date`, errors.date)} name="date" type="date" defaultValue={defaults?.date} min={start} max={last} onChange={() => onEdit('date')} />
    </Field>
  </>;
}

/** Validate on submit, show every error under its field, focus the first one and only then save. */
export function useValidatedSubmit<T>(validate: (data: FormData) => Validated<T>, save: (values: T) => void) {
  const state = useFieldErrors();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = validate(new FormData(form));
    if (!result.ok) { state.setErrors(result.errors); focusFirstInvalid(form); return; }
    state.setErrors({});
    save(result.values);
  }
  return { ...state, submit };
}

interface AddBudgetProps { pending: number; disabled: boolean; onSave: Save; add: (name: string, amount: number) => Promise<unknown> }

export function AddBudgetItemForm({ pending, disabled, onSave, add }: AddBudgetProps) {
  const [version, setVersion] = useState(0);
  const { errors, clear, submit } = useValidatedSubmit(validateBudgetItemForm, values => onSave(async () => { await add(values.name, values.amount); setVersion(old => old + 1); }, 'Rubro guardado'));
  return <form noValidate key={version} onSubmit={submit} className={moduleClass('project-form-grid')}>
    <TextField id="new-budget-name" name="name" label="Nombre del rubro" max={TEXT_LIMITS.budgetName} placeholder="Por ejemplo: Materiales e insumos" error={errors.name} onEdit={clear} />
    <MoneyField id="new-budget-amount" name="amount" label="Asignación (USD)" error={errors.amount} hint={`Pendiente de asignar: ${formatMoney(pending)}`} onEdit={clear} />
    <button type="submit" disabled={disabled} className={moduleClass('project-primary')}>Guardar rubro</button>
  </form>;
}

interface AddExpenseProps { itemId: string; balance: number; start: string; end: string; disabled: boolean; onSave: Save; add: (amount: number, description: string, date: string) => Promise<unknown> }

export function AddExpenseForm({ itemId, balance, start, end, disabled, onSave, add }: AddExpenseProps) {
  const [version, setVersion] = useState(0);
  const { errors, clear, submit } = useValidatedSubmit((data: FormData) => validateExpenseForm(data, { balance, start, end }),
    values => onSave(async () => { await add(values.amount, values.description, values.date); setVersion(old => old + 1); }, 'Gasto registrado'));
  const empty = balance <= 0;
  return <form noValidate key={version} onSubmit={submit}>
    {empty && <p role="status" className={moduleClass('project-notice')}>Este rubro no tiene saldo disponible. Aumenta su asignación para registrar gastos.</p>}
    <fieldset disabled={empty} className={moduleClass('project-fieldset project-form-grid')}>
      <ExpenseFields prefix={`expense-${itemId}`} errors={errors} onEdit={clear} balance={balance} start={start} end={end} />
      <button type="submit" disabled={disabled || empty} className={moduleClass('project-primary')}>Registrar gasto</button>
    </fieldset>
  </form>;
}

interface AddMemberProps { options: MemberOption[]; disabled: boolean; onSave: Save; add: (profileId: string, role: string) => Promise<unknown> }

export function AddMemberForm({ options, disabled, onSave, add }: AddMemberProps) {
  const [version, setVersion] = useState(0);
  const { errors, clear, submit } = useValidatedSubmit((data: FormData): Validated<{ role: string; profile: string }> => {
    const role = validateRoleForm(data);
    const profile = String(data.get('profile') ?? '');
    const found: Errors = { ...(role.ok ? {} : role.errors), ...(profile ? {} : { profile: 'Selecciona un perfil existente.' }) };
    return Object.keys(found).length || !role.ok ? { ok: false, errors: found } : { ok: true, values: { role: role.values.role, profile } };
  }, values => onSave(async () => { await add(values.profile, values.role); setVersion(old => old + 1); }, 'Participante añadido'));
  return <form noValidate key={version} className={moduleClass('project-form-grid')} onSubmit={submit}>
    <Field id="new-member-profile" label="Persona" error={errors.profile}>
      <select {...fieldProps('new-member-profile', errors.profile)} name="profile" defaultValue="" onChange={() => clear('profile')}>
        <option value="" disabled>Selecciona un perfil existente</option>
        {options.map(option => <option key={option.profile_id} value={option.profile_id}>{option.full_name} ({option.email})</option>)}
      </select>
    </Field>
    <TextField id="new-member-role" name="role" label="Responsabilidad" max={TEXT_LIMITS.role} list="project-member-roles" error={errors.role} onEdit={clear} />
    <button type="submit" disabled={disabled || !options.length}>Añadir participante</button>
  </form>;
}
