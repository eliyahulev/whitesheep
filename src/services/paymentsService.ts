import {
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { col } from '@/firebase/collections';
import { functions } from '@/firebase/config';
import type { Payment } from '@/types/models';

// Payment link generation + settlement run in Cloud Functions (Morning credentials
// live server-side). The functions write back to the order and the payments collection.

export interface PaymentLinkResult {
  url: string;
  expiresAt: number; // epoch ms
  simulated: boolean;
}

export interface SettleResult {
  paid?: boolean;
  alreadyPaid?: boolean;
  isPrivate?: boolean;
  invoiceId?: string | null;
  invoiceUrl?: string | null;
  simulated?: boolean;
}

/** Create a Morning payment link for the order (stored on the order by the function). */
export async function createPaymentLink(orderId: string): Promise<PaymentLinkResult> {
  const fn = httpsCallable<{ orderId: string }, PaymentLinkResult>(functions, 'createOrderPaymentLink');
  const res = await fn({ orderId });
  return res.data;
}

/**
 * Settle the order's payment (simulates the payment-provider webhook): marks paid,
 * issues + sends a חשבונית מס קבלה for private customers, records the payment.
 */
export async function settlePayment(orderId: string): Promise<SettleResult> {
  const fn = httpsCallable<{ orderId: string }, SettleResult>(functions, 'settleOrderPayment');
  const res = await fn({ orderId });
  return res.data;
}

/** Live payments for an order. */
export function watchOrderPayments(orderId: string, onChange: (p: Payment[]) => void): () => void {
  const q = query(col.payments, where('orderId', '==', orderId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) })));
  });
}
