import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';

// Messaging integration interface. The real provider (Twilio/Inforu) runs in the
// `sendSms` Cloud Function (Module 3) with credentials server-side. The stub logs only.
// Swap by changing `settings.integrations.smsProvider` — call sites depend only on this.

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface MessagingProvider {
  readonly name: string;
  sendSms(to: string, body: string): Promise<SendResult>;
}

/** Client-side stub — logs instead of sending. Used only when smsProvider === 'stub'. */
export const stubMessagingProvider: MessagingProvider = {
  name: 'stub',
  async sendSms(to, body) {
    // eslint-disable-next-line no-console
    console.info('[sms:stub] →', to, '\n', body);
    return { ok: true, providerMessageId: `stub-${to}` };
  },
};

/** Real provider: invokes the sendSms Cloud Function (credentials live server-side). */
const cloudMessagingProvider: MessagingProvider = {
  name: 'cloud',
  async sendSms(to, body) {
    try {
      const fn = httpsCallable<{ to: string; body: string }, SendResult>(functions, 'sendSms');
      const res = await fn({ to, body });
      return res.data;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export function getMessagingProvider(providerName: string): MessagingProvider {
  return providerName === 'stub' ? stubMessagingProvider : cloudMessagingProvider;
}
