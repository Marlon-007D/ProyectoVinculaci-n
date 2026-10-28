import { formatMoney, formatNumericDate } from './projectPresentation';
import { ecuadorToday, isCalendarDate, parseMoneyInput, remainingMoney, TEXT_LIMITS, toCents, validateText } from './projectValidation';

export type Errors = Record<string, string>;
export type Validated<T> = { ok: true; values: T } | { ok: false; errors: Errors };

const read = (data: FormData, name: string) => String(data.get(name) ?? '');

function collect<T>(errors: Errors, values: T): Validated<T> {
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

export function validateProjectForm(data: FormData, bounds?: { min?: string; max?: string }) {
  const errors: Errors = {};
  const name = validateText(read(data, 'name'), TEXT_LIMITS.projectName);
  if (!name.ok) errors.name = name.message;
  const budget = parseMoneyInput(read(data, 'budget'), { allowZero: true });
  if (!budget.ok) errors.budget = budget.message;
  const description = validateText(read(data, 'description'), TEXT_LIMITS.description);
  if (!description.ok) errors.description = description.message;
  const start = read(data, 'start');
  const end = read(data, 'end');
  if (!isCalendarDate(start)) errors.start = 'Elige una fecha de inicio válida.';
  else if (bounds?.min && start < bounds.min) errors.start = `La fecha de inicio debe ser el ${formatNumericDate(bounds.min)} o posterior.`;
  else if (bounds?.max && start > bounds.max) errors.start = `La fecha de inicio debe ser el ${formatNumericDate(bounds.max)} o anterior.`;
  if (!isCalendarDate(end)) errors.end = 'Elige una fecha de finalización válida.';
  else if (isCalendarDate(start) && end < start) errors.end = 'La fecha final no puede ser anterior al inicio.';
  else if (bounds?.max && end > bounds.max) errors.end = `La fecha de finalización debe ser el ${formatNumericDate(bounds.max)} o anterior.`;
  return collect(errors, {
    name: name.ok ? name.value : '', description: description.ok ? description.value : '',
    budget_total: budget.ok ? budget.value : 0, start_date: start, end_date: end,
  });
}

export function validateBudgetItemForm(data: FormData) {
  const errors: Errors = {};
  const name = validateText(read(data, 'name'), TEXT_LIMITS.budgetName);
  if (!name.ok) errors.name = name.message;
  const amount = parseMoneyInput(read(data, 'amount'));
  if (!amount.ok) errors.amount = amount.message;
  return collect(errors, { name: name.ok ? name.value : '', amount: amount.ok ? amount.value : 0 });
}

/** Message shown under «Importe» when the amount is above the rubro balance. */
export function balanceError(amount: number, balance: number): string {
  return toCents(amount) > toCents(balance) ? `Supera el saldo disponible del rubro por ${formatMoney(remainingMoney(amount, balance))}.` : '';
}

export function validateExpenseForm(data: FormData, context: { balance: number; start: string; end: string; today?: string }) {
  const errors: Errors = {};
  const description = validateText(read(data, 'description'), TEXT_LIMITS.expense);
  if (!description.ok) errors.description = description.message;
  const amount = parseMoneyInput(read(data, 'amount'));
  if (!amount.ok) errors.amount = amount.message;
  else if (balanceError(amount.value, context.balance)) errors.amount = balanceError(amount.value, context.balance);
  const date = read(data, 'date');
  const last = (context.today ?? ecuadorToday()) < context.end ? (context.today ?? ecuadorToday()) : context.end;
  if (!isCalendarDate(date)) errors.date = 'Elige una fecha válida.';
  else if (date < context.start) errors.date = `La fecha no puede ser anterior al inicio del proyecto (${formatNumericDate(context.start)}).`;
  else if (date > last) errors.date = `La fecha no puede ser posterior al ${formatNumericDate(last)}.`;
  return collect(errors, { description: description.ok ? description.value : '', amount: amount.ok ? amount.value : 0, date });
}

export function validateRoleForm(data: FormData) {
  const errors: Errors = {};
  const role = validateText(read(data, 'role'), TEXT_LIMITS.role);
  if (!role.ok) errors.role = role.message;
  return collect(errors, { role: role.ok ? role.value : '' });
}
