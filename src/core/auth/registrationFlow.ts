
export interface RegistrationEndpoint {
  invoke(name: string, options: { body: Record<string, string> }): Promise<{ data: { registered?: boolean; error?: string } | null; error: unknown }>;
}
export async function registrationError(error: unknown): Promise<Error> {
  const details = error as { message?: unknown; context?: { clone?: () => { json: () => Promise<{ error?: string; message?: string }> }; json?: () => Promise<{ error?: string; message?: string }> } } | null;
  try {
    const response = details?.context?.clone?.() ?? details?.context;
    const body = await response?.json?.();
    const message = body?.error || body?.message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  } catch { /* Preserve the original Supabase error if the response is not JSON. */ }
  return new Error(typeof details?.message === 'string' && details.message.trim() ? details.message : 'No se pudo completar la solicitud.');
}
export async function performInstitutionalRegistration(endpoint: RegistrationEndpoint, input: {
  email: string; password: string; firstName: string; lastName: string; institutionId: string;
}) {
  const { data, error } = await endpoint.invoke('register-institution-user', { body: {
    email: input.email.trim().toLowerCase(), password: input.password,
    firstName: input.firstName.trim(), lastName: input.lastName.trim(), institutionId: input.institutionId,
  } });
  return { error: error ? await registrationError(error) : !data?.registered ? new Error(data?.error || 'No se pudo guardar la solicitud institucional.') : null };
}
