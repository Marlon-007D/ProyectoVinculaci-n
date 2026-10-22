
export interface RegistrationEndpoint {
  invoke(name: string, options: { body: Record<string, string> }): Promise<{ data: { registered?: boolean; error?: string } | null; error: unknown }>;
}
export function translateRegistrationMessage(message: string): string {
  const normalized = message.trim().toLowerCase();
  if (/already (?:been )?registered|user already exists|email.*already.*(?:registered|exists)/.test(normalized))
    return 'Este correo electrónico ya se encuentra registrado. Por favor, inicia sesión o usa otra cuenta.';
  if (/email.*invalid|invalid.*email/.test(normalized)) return 'Ingresa un correo electrónico válido.';
  if (/password.*(?:short|least|weak)|weak.*password/.test(normalized)) return 'La contraseña es demasiado débil. Usa al menos 12 caracteres.';
  if (/rate limit|too many requests/.test(normalized)) return 'Se han realizado demasiados intentos. Inténtalo de nuevo más tarde.';
  if (/failed to fetch|fetch failed|network/.test(normalized)) return 'No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.';
  if (/database error saving new user/.test(normalized)) return 'No se pudo guardar la cuenta. Contacta al administrador de tu institución.';
  return message;
}
export async function registrationError(error: unknown): Promise<Error> {
  const details = error as { message?: unknown; context?: { clone?: () => { json: () => Promise<{ error?: string; message?: string }> }; json?: () => Promise<{ error?: string; message?: string }> } } | null;
  try {
    const response = details?.context?.clone?.() ?? details?.context;
    const body = await response?.json?.();
    const message = body?.error || body?.message;
    if (typeof message === 'string' && message.trim()) return new Error(translateRegistrationMessage(message));
  } catch { /* Preserve the original Supabase error if the response is not JSON. */ }
  return new Error(typeof details?.message === 'string' && details.message.trim() ? translateRegistrationMessage(details.message) : 'No se pudo completar la solicitud.');
}
export async function performInstitutionalRegistration(endpoint: RegistrationEndpoint, input: {
  email: string; password: string; firstName: string; lastName: string; institutionId: string;
}) {
  const { data, error } = await endpoint.invoke('register-institution-user', { body: {
    email: input.email.trim().toLowerCase(), password: input.password,
    firstName: input.firstName.trim(), lastName: input.lastName.trim(), institutionId: input.institutionId,
  } });
  return { error: error ? await registrationError(error) : !data?.registered ? new Error(translateRegistrationMessage(data?.error || 'No se pudo guardar la solicitud institucional.')) : null };
}
