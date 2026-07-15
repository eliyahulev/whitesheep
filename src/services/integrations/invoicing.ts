// Invoicing integration interface. Real provider (Morning/Green Invoice/iCount) is
// wired in Module 4 as a Cloud Function; stub returns a fake invoice for now.

export interface InvoiceRequest {
  customerName: string;
  customerTaxId?: string;
  amount: number;
  description: string;
  docType: 'tax_invoice_receipt' | 'monthly_consolidated';
}

export interface InvoiceResult {
  ok: boolean;
  invoiceId?: string;
  pdfUrl?: string;
  error?: string;
}

export interface InvoiceProvider {
  readonly name: string;
  issue(req: InvoiceRequest): Promise<InvoiceResult>;
}

export const stubInvoiceProvider: InvoiceProvider = {
  name: 'stub',
  async issue(req) {
    // eslint-disable-next-line no-console
    console.info('[invoice:stub] issue', req);
    return { ok: true, invoiceId: `stub-inv-${Date.now()}`, pdfUrl: '#' };
  },
};

export function getInvoiceProvider(_providerName: string): InvoiceProvider {
  // Module 4 will register real providers here.
  return stubInvoiceProvider;
}
