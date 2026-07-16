// Morning (Green Invoice) API client — https://developers.morning.co / greeninvoice.docs.apiary.io
// Runs server-side only (credentials in env). Behind the InvoiceProvider interface so the
// provider can be swapped. Falls back to a simulated provider when credentials are absent,
// so the payment/invoice flow is fully testable locally.

export interface InvoiceClient {
  name: string;
  emails: string[];
  taxId?: string;
}

export interface PaymentFormParams {
  amount: number;
  description: string;
  client: InvoiceClient;
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
}

export interface DocumentParams {
  type: number; // Morning document type (320 = חשבונית מס קבלה)
  amount: number;
  description: string;
  client: InvoiceClient;
}

export interface ConsolidatedParams {
  type: number;
  client: InvoiceClient;
  lines: { description: string; amount: number }[]; // one row per delivery note
}

export interface InvoiceResult {
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
  simulated?: boolean;
}

export interface InvoiceProvider {
  readonly name: string;
  createPaymentForm(
    p: PaymentFormParams,
  ): Promise<{ ok: boolean; url?: string; error?: string; simulated?: boolean }>;
  issueDocument(p: DocumentParams): Promise<InvoiceResult>;
  /** Multi-line document (e.g. a monthly consolidated invoice). */
  issueConsolidated(p: ConsolidatedParams): Promise<InvoiceResult>;
}

/** Morning document type codes. */
export const DOC_TYPE = {
  TAX_INVOICE: 305, // חשבונית מס (used for monthly consolidated billing)
  TAX_INVOICE_RECEIPT: 320, // חשבונית מס קבלה
} as const;

// Income-line VAT handling. Our prices (finalCost / delivery-note amounts) are the
// amount the customer actually pays — i.e. VAT-INCLUSIVE, matching the payment link's
// charge. vatType 1 tells Morning the line price already includes VAT (it back-calculates
// the VAT component), so the document total equals what was paid. vatType 0 would ADD VAT
// on top, making the receipt total exceed the payment → error 2014/2422 (receipts≠payments).
const VAT_TYPE_INCLUDED = 1;

interface MorningConfig {
  id: string;
  secret: string;
  base: string;
}

function readConfig(): MorningConfig | null {
  const id = process.env.MORNING_API_ID;
  const secret = process.env.MORNING_API_SECRET;
  if (!id || !secret) return null;
  const base =
    process.env.MORNING_ENV === 'production'
      ? 'https://api.greeninvoice.co.il/api/v1'
      : 'https://sandbox.d.greeninvoice.co.il/api/v1';
  return { id, secret, base };
}

// Cache the JWT until shortly before it expires.
let tokenCache: { token: string; expires: number } | null = null;

async function getToken(cfg: MorningConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expires - 60 > now) return tokenCache.token;
  const res = await fetch(`${cfg.base}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: cfg.id, secret: cfg.secret }),
  });
  if (!res.ok) throw new Error(`Morning token failed: HTTP ${res.status}`);
  const data = (await res.json()) as { token: string; expires: number };
  tokenCache = { token: data.token, expires: data.expires };
  return data.token;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function morningProvider(cfg: MorningConfig): InvoiceProvider {
  return {
    name: 'morning',
    async createPaymentForm(p) {
      try {
        const token = await getToken(cfg);
        const res = await fetch(`${cfg.base}/payments/form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            description: p.description,
            type: DOC_TYPE.TAX_INVOICE_RECEIPT, // document auto-issued by Morning on payment
            lang: 'he',
            currency: 'ILS',
            amount: p.amount, // payment-form charge total (VAT-inclusive); field is `amount`, not `price`
            client: { name: p.client.name, emails: p.client.emails, taxId: p.client.taxId, add: true },
            successUrl: p.successUrl,
            failureUrl: p.failureUrl,
            notifyUrl: p.notifyUrl,
          }),
        });
        const data = (await res.json()) as { url?: string; errorMessage?: string };
        if (!res.ok) return { ok: false, error: data?.errorMessage ?? `HTTP ${res.status}` };
        return { ok: true, url: data.url };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async issueDocument(p) {
      try {
        const token = await getToken(cfg);
        const res = await fetch(`${cfg.base}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: p.type,
            date: today(),
            lang: 'he',
            currency: 'ILS',
            rounding: false,
            signature: true,
            client: { name: p.client.name, emails: p.client.emails, taxId: p.client.taxId, add: true },
            income: [
              {
                description: p.description,
                quantity: 1,
                price: p.amount,
                currency: 'ILS',
                vatType: VAT_TYPE_INCLUDED,
              },
            ],
            payment: [{ type: 4 /* credit card */, price: p.amount, date: today() }],
            remarks: 'הופק אוטומטית עם קבלת התשלום',
          }),
        });
        const data = (await res.json()) as {
          id?: string;
          url?: { origin?: string; he?: string } | string;
          errorMessage?: string;
        };
        if (!res.ok) return { ok: false, error: data?.errorMessage ?? `HTTP ${res.status}` };
        const url =
          typeof data.url === 'string' ? data.url : data.url?.he ?? data.url?.origin ?? undefined;
        return { ok: true, id: data.id, url };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async issueConsolidated(p) {
      try {
        const token = await getToken(cfg);
        const res = await fetch(`${cfg.base}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: p.type,
            date: today(),
            lang: 'he',
            currency: 'ILS',
            rounding: false,
            signature: true,
            client: { name: p.client.name, emails: p.client.emails, taxId: p.client.taxId, add: true },
            income: p.lines.map((l) => ({
              description: l.description,
              quantity: 1,
              price: l.amount,
              currency: 'ILS',
              vatType: VAT_TYPE_INCLUDED,
            })),
            remarks: 'חשבונית חודשית מרוכזת',
          }),
        });
        const data = (await res.json()) as {
          id?: string;
          url?: { origin?: string; he?: string } | string;
          errorMessage?: string;
        };
        if (!res.ok) return { ok: false, error: data?.errorMessage ?? `HTTP ${res.status}` };
        const url =
          typeof data.url === 'string' ? data.url : data.url?.he ?? data.url?.origin ?? undefined;
        return { ok: true, id: data.id, url };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

const simulatedInvoiceProvider: InvoiceProvider = {
  name: 'simulated',
  async createPaymentForm(p) {
    const url = `https://pay.sandbox.example/form/${encodeURIComponent(p.description)}`;
    console.log('[invoice:simulated] payment form', p.amount, '→', url);
    return { ok: true, url, simulated: true };
  },
  async issueDocument(p) {
    const id = `sim-doc-${Date.now()}`;
    console.log('[invoice:simulated] issue document type', p.type, 'amount', p.amount, '→', id);
    return { ok: true, id, url: `https://docs.sandbox.example/${id}.pdf`, simulated: true };
  },
  async issueConsolidated(p) {
    const id = `sim-monthly-${Date.now()}`;
    const total = p.lines.reduce((s, l) => s + l.amount, 0);
    console.log(
      `[invoice:simulated] consolidated type ${p.type} · ${p.lines.length} lines · total ${total} → ${id}`,
    );
    return { ok: true, id, url: `https://docs.sandbox.example/${id}.pdf`, simulated: true };
  },
};

export function resolveInvoiceProvider(): InvoiceProvider {
  const cfg = readConfig();
  return cfg ? morningProvider(cfg) : simulatedInvoiceProvider;
}
