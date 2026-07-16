import { type Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveProvider } from './messaging';

// Debt engine (Module 5). Two sweeps, run on a schedule and also on demand:
//  1) markExpiredDebts — unpaid orders whose payment link has expired become open debts.
//  2) sendDueReminders — send reminders at the configured day-intervals from settings.
// Both are attributed to the system in the audit log.

const DAY_MS = 24 * 60 * 60 * 1000;

function fill(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v);
  return out;
}

async function systemLog(db: Firestore, actionType: string, description: string) {
  await db.collection('auditLog').add({
    userId: 'system',
    userName: 'מערכת',
    actionType,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}

interface OrderDoc {
  orderNumber: number;
  customerId: string;
  customerName: string;
  finalCost: number | null;
  paid?: boolean;
  isDebt?: boolean;
  paymentLink?: string;
  paymentLinkExpiresAt?: Timestamp;
  debtSince?: Timestamp;
  debtReminders?: number;
}

/** Unpaid orders whose payment link has expired → mark as an open debt. */
export async function markExpiredDebts(db: Firestore): Promise<number> {
  const now = Timestamp.now();
  const snap = await db.collection('orders').where('paymentLinkExpiresAt', '<=', now).get();
  let marked = 0;
  for (const docSnap of snap.docs) {
    const o = docSnap.data() as OrderDoc;
    if (o.paid === true || o.isDebt === true || o.finalCost == null) continue;
    await docSnap.ref.update({
      isDebt: true,
      debtSince: o.paymentLinkExpiresAt ?? now,
      debtReminders: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await systemLog(
      db,
      'financial',
      `הזמנה #${o.orderNumber} הפכה לחוב פתוח על סך ${o.finalCost} ש"ח (${o.customerName})`,
    );
    marked++;
  }
  return marked;
}

/** Send the next due reminder for each open debt, per settings.reminderIntervalsDays. */
export async function sendDueReminders(db: Firestore): Promise<number> {
  const settings = ((await db.doc('settings/global').get()).data() ?? {}) as {
    reminderIntervalsDays?: number[];
    templates?: { debtReminder?: string };
  };
  const intervals = settings.reminderIntervalsDays ?? [3, 7];
  const tpl =
    settings.templates?.debtReminder ??
    'שלום [שם הלקוח], זוהי תזכורת ידידותית כי קיים חוב פתוח על סך [סכום] ש"ח עבור הזמנה מספר [מספר]. לתשלום מהיר ומאובטח בקישור: [קישור לתשלום].';

  const now = Date.now();
  const provider = resolveProvider();
  const snap = await db.collection('orders').where('isDebt', '==', true).get();
  let sent = 0;

  for (const docSnap of snap.docs) {
    const o = docSnap.data() as OrderDoc;
    if (o.paid === true || o.finalCost == null || !o.debtSince) continue;
    const already = o.debtReminders ?? 0;
    if (already >= intervals.length) continue; // all scheduled reminders sent
    const dueAt = o.debtSince.toMillis() + intervals[already] * DAY_MS;
    if (now < dueAt) continue; // not due yet

    const custSnap = await db.doc(`customers/${o.customerId}`).get();
    const cust = (custSnap.data() ?? {}) as { name?: string; phone?: string };
    const body = fill(tpl, {
      '[שם הלקוח]': cust.name ?? o.customerName,
      '[סכום]': String(o.finalCost),
      '[מספר]': String(o.orderNumber),
      '[קישור לתשלום]': o.paymentLink ?? '',
    });
    if (cust.phone) await provider.send(cust.phone, body);

    await docSnap.ref.update({
      debtReminders: already + 1,
      lastReminderAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await systemLog(
      db,
      'financial',
      `System: sent debt reminder to ${cust.name ?? o.customerName} for ${o.finalCost} ₪ (הזמנה #${o.orderNumber}, תזכורת ${already + 1})`,
    );
    sent++;
  }
  return sent;
}
