import { isValidAdminEmail } from './contactValidation.ts';
export interface AdminField {
  value: string; required: boolean; type: string; minLength: number;
  maxLength: number; pattern?: string; checked?: boolean;
}

export function adminFieldIssue(field: AdminField): string | null {
  const value = field.value;
  if (field.required && (!value.trim() || (field.type === 'checkbox' && !field.checked))) return 'Completa todos los campos obligatorios.';
  if (!value) return null;
  if (field.type === 'email' && !isValidAdminEmail(value)) return 'Por favor, ingresa un correo electrónico válido.';
  if (field.minLength > 0 && value.length < field.minLength) return `Ingresa al menos ${field.minLength} caracteres en el campo indicado.`;
  if (field.maxLength > 0 && value.length > field.maxLength) return `Ingresa como máximo ${field.maxLength} caracteres en el campo indicado.`;
  if (field.pattern && !new RegExp(`^(?:${field.pattern})$`, 'u').test(value)) return 'Revisa el formato del campo indicado.';
  return null;
}
