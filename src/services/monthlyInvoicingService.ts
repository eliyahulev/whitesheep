import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import type { Order } from '@/types/models';

/** An open delivery note: a priced institutional order not yet consolidated or paid. */
export function isOpenDeliveryNote(o: Order): boolean {
  return o.finalCost != null && !o.consolidatedInvoiceId && o.paid !== true;
}

export interface MonthlyInvoiceResult {
  invoiceId?: string;
  invoiceUrl?: string;
  count: number;
  total: number;
  simulated: boolean;
}

/** Consolidate a customer's open delivery notes into one monthly invoice (Morning). */
export async function issueMonthlyInvoice(customerId: string): Promise<MonthlyInvoiceResult> {
  const fn = httpsCallable<{ customerId: string }, MonthlyInvoiceResult>(
    functions,
    'issueMonthlyInvoice',
  );
  const res = await fn({ customerId });
  return res.data;
}
