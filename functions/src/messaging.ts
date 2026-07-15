// Server-side messaging provider behind an interface. Credentials come from env
// (Cloud Functions config / .env), never from the client. Swap providers by changing
// MESSAGING_PROVIDER — call sites depend only on MessagingProvider.

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface MessagingProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SendResult>;
}

/** Normalize an Israeli mobile (05x-xxxxxxx / 0xxxxxxxxx) to E.164 (+972…). */
export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

/** Twilio SMS provider (used when credentials are present). */
function twilioProvider(sid: string, token: string, from: string): MessagingProvider {
  return {
    name: 'twilio',
    async send(to, body) {
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: toE164(to), From: from, Body: body }),
          },
        );
        const data: unknown = await res.json();
        if (!res.ok) {
          const msg = (data as { message?: string })?.message ?? `HTTP ${res.status}`;
          return { ok: false, error: msg };
        }
        return { ok: true, providerMessageId: (data as { sid?: string })?.sid };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

/** Simulated provider — used in dev / when no credentials are configured. */
const simulatedProvider: MessagingProvider = {
  name: 'simulated',
  async send(to, body) {
    console.log(`[messaging:simulated] → ${to}\n${body}`);
    return { ok: true, providerMessageId: `sim-${Date.now()}`, simulated: true };
  },
};

/** Resolve the active provider from env. Falls back to simulated when creds are absent. */
export function resolveProvider(): MessagingProvider {
  const provider = process.env.MESSAGING_PROVIDER ?? 'twilio';
  if (provider === 'twilio') {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
    if (sid && token && from) return twilioProvider(sid, token, from);
  }
  return simulatedProvider;
}
