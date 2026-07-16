import { addDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { col } from '@/firebase/collections';
import { db, functions } from '@/firebase/config';
import type { Order } from '@/types/models';
import { getCustomer } from './customersService';
import { loadSettings } from './settingsService';
import { getMessagingProvider, type SendResult } from './integrations/messaging';
import { fillTemplate } from './messageTemplates';
import { logAction, type ActingUser } from './logAction';
import { toDate } from '@/utils/format';

/** Live list of open debts (payment link expired unpaid), most-overdue first. */
export function watchDebtors(onChange: (orders: Order[]) => void): () => void {
  const q = query(col.orders, where('isDebt', '==', true));
  return onSnapshot(q, (snap) => {
    const debts = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
      .filter((o) => o.paid !== true)
      .sort((a, b) => (toDate(a.debtSince)?.getTime() ?? 0) - (toDate(b.debtSince)?.getTime() ?? 0));
    onChange(debts);
  });
}

export type ManualPayMethod = 'cash' | 'transfer';

/** Close a debt manually (cash/transfer) → status paid_manually, recorded + logged. */
export async function closeDebt(order: Order, method: ManualPayMethod, user: ActingUser | null) {
  await updateDoc(doc(db, 'orders', order.id), {
    paid: true,
    isDebt: false,
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(col.payments, {
    orderId: order.id,
    customerId: order.customerId,
    amount: order.finalCost ?? 0,
    status: 'paid_manually',
    method,
    invoiceId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const label = method === 'cash' ? 'מזומן' : 'העברה בנקאית';
  await logAction(
    user,
    'financial',
    `סגירת חוב ידנית להזמנה #${order.orderNumber} על סך ${order.finalCost} ש"ח (${label})`,
  );
}

/** Send an additional manual debt reminder now (independent of the schedule). */
export async function sendManualReminder(order: Order, user: ActingUser | null): Promise<SendResult> {
  const settings = await loadSettings();
  const customer = await getCustomer(order.customerId);
  if (!customer) return { ok: false, error: 'הלקוח לא נמצא' };
  const body = fillTemplate(settings.templates.debtReminder, {
    '[שם הלקוח]': customer.name,
    '[סכום]': String(order.finalCost ?? 0),
    '[מספר]': String(order.orderNumber),
    '[קישור לתשלום]': order.paymentLink ?? '',
  });
  const provider = getMessagingProvider(settings.integrations.smsProvider);
  const res = await provider.sendSms(customer.phone, body);
  await logAction(
    user,
    'financial',
    `תזכורת חוב ידנית להזמנה #${order.orderNumber}: ` +
      (res.ok ? (res.simulated ? 'נשלחה (סימולציה)' : 'נשלחה') : `נכשלה — ${res.error}`),
  );
  return res;
}

/** Manager: run the debt engine now (mark expired debts + send due reminders). */
export async function runDebtEngine(): Promise<{ marked: number; reminded: number }> {
  const fn = httpsCallable<Record<string, never>, { marked: number; reminded: number }>(
    functions,
    'runDebtEngine',
  );
  const res = await fn({});
  return res.data;
}
