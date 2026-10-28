export function normalizeAdminEmail(value: string): string {
  return value.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
}

export function isValidAdminEmail(value: string): boolean {
  const email = normalizeAdminEmail(value);
  if (email.length > 254 || email.includes('..')) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(email)
    && !email.startsWith('.') && !email.includes('.@');
}

export function normalizeContactName(value: string): string {
  return value.normalize('NFC').replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeContact<T extends { email: string; first_name: string; last_name: string }>(contact: T): T {
  return { ...contact, email: normalizeAdminEmail(contact.email), first_name: normalizeContactName(contact.first_name ?? ''), last_name: normalizeContactName(contact.last_name ?? '') };
}

export function validateAdminContact<T extends { email: string; firstName: string; lastName: string }>(input: T): T {
  const result = { ...input, email: normalizeAdminEmail(input.email), firstName: normalizeContactName(input.firstName), lastName: normalizeContactName(input.lastName) };
  if (!isValidAdminEmail(result.email)) throw new Error('El correo electrónico no es válido. Revisa la dirección original; no se eliminará texto para cambiar el destinatario.');
  if (!result.firstName || !result.lastName || result.firstName.length > 100 || result.lastName.length > 100) throw new Error('Revisa nombres y apellidos: son obligatorios y admiten hasta 100 caracteres.');
  return result;
}

/** Extract a numeric suffix only; do not discard another address. */
export function extractRequestEmail(value: string): string {
  const normalized = normalizeAdminEmail(value);
  if (isValidAdminEmail(normalized)) return normalized;
  const match = /^([^\s@]+@(?:[a-z0-9-]+\.)+[a-z]{2,63})[0-9]+$/i.exec(normalized);
  return match && isValidAdminEmail(match[1]) ? match[1] : normalized;
}
