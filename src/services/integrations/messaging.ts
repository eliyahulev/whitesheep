// Messaging integration interface. The real provider (Inforu/Twilio) is wired in
// Module 3 as a Cloud Function; for now a stub logs the message. Swap by changing
// `settings.integrations.smsProvider` — call sites never depend on a concrete provider.

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface MessagingProvider {
  readonly name: string;
  sendSms(to: string, body: string): Promise<SendResult>;
}

/** Stub provider — logs instead of sending. Used until Module 3. */
export const stubMessagingProvider: MessagingProvider = {
  name: 'stub',
  async sendSms(to, body) {
    // eslint-disable-next-line no-console
    console.info('[sms:stub] →', to, '\n', body);
    return { ok: true, providerMessageId: `stub-${to}` };
  },
};

export function getMessagingProvider(_providerName: string): MessagingProvider {
  // Module 3 will register real providers here.
  return stubMessagingProvider;
}
