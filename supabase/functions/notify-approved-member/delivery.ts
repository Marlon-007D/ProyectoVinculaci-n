type DeliveryInput = { apiKey: string; from: string; to: string; text: string; siteUrl: string; testMode: boolean };
export type DeliveryResult = { status: 'sent' } | { status: 'testSent' } | { status: 'failed' };

export async function deliverApprovalEmail(input: DeliveryInput, transport: typeof fetch = fetch): Promise<DeliveryResult> {
  const send = async (to: string) => {
    const body = JSON.stringify({ from: input.from, to: [to], subject: 'Tu solicitud institucional fue aprobada', text: input.text });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return transport('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${input.apiKey.trim()}`, 'Content-Type': 'application/json', 'Idempotency-Key': `approval/${fingerprint}` }, body,
    });
  };
  const response = await send(input.to);
  if (response.ok) return { status: 'sent' };
  const failure = await response.json().catch(() => null) as { message?: string } | null;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(input.siteUrl).hostname);
  const sandboxDenied = response.status === 403 && /only send testing emails|testing emails.*own email/i.test(failure?.message ?? '');
  if (!input.testMode || !local || !sandboxDenied || input.to.toLowerCase() === 'dmsosa2@espe.edu.ec') return { status: 'failed' };
  const retry = await send('dmsosa2@espe.edu.ec');
  return { status: retry.ok ? 'testSent' : 'failed' };
}
