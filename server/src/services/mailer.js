export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
}

export async function sendMail({ to, subject, text, html }, { fetchImpl = fetch } = {}) {
  if (!mailConfigured()) {
    console.warn(JSON.stringify({ level: 'warn', message: 'Email is not configured; message was not sent', to: '[redacted]' }));
    return { delivered: false, reason: 'not-configured' };
  }
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', message: 'Email delivery failed', status: response.status }));
    return { delivered: false, reason: 'provider-error' };
  }
  return { delivered: true };
}
