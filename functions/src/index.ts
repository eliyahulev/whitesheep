import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveProvider, type SendResult } from './messaging';
import { resolveInvoiceProvider, DOC_TYPE } from './morning';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
initializeApp();
const db = getFirestore();

// --- helpers ---
function requireStaff(req: CallableRequest): { uid: string; name: string } {
  if (!req.auth) throw new HttpsError('unauthenticated', 'התחברות נדרשת.');
  const role = req.auth.token.role;
  if (role !== 'employee' && role !== 'manager') {
    throw new HttpsError('permission-denied', 'אין הרשאה.');
  }
  const t = req.auth.token as { name?: string; email?: string };
  return { uid: req.auth.uid, name: t.name || t.email || 'מערכת' };
}

async function serverLog(
  actor: { uid: string; name: string },
  actionType: string,
  description: string,
) {
  await db.collection('auditLog').add({
    userId: actor.uid,
    userName: actor.name,
    actionType,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v);
  return out;
}

// ============================================================
// Module 3 — messaging
// ============================================================
interface SendSmsData {
  to: string;
  body: string;
}

export const sendSms = onCall<SendSmsData>(async (request): Promise<SendResult> => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'התחברות נדרשת לשליחת הודעות.');
  const role = request.auth.token.role;
  if (role !== 'employee' && role !== 'manager') {
    throw new HttpsError('permission-denied', 'אין הרשאה לשליחת הודעות.');
  }
  const { to, body } = request.data ?? ({} as SendSmsData);
  if (!to || !body) throw new HttpsError('invalid-argument', 'חסרים נמען או תוכן ההודעה.');

  const provider = resolveProvider();
  const result = await provider.send(to, body);
  console.log(`[sendSms] provider=${provider.name} to=${to} ok=${result.ok}`);
  return result;
});

// ============================================================
// Module 4 — payments, checkout link & invoice on payment (Morning)
// ============================================================

async function loadOrderContext(orderId: string) {
  const orderRef = db.doc(`orders/${orderId}`);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError('not-found', 'ההזמנה לא נמצאה.');
  const order = orderSnap.data() as {
    orderNumber: number;
    customerId: string;
    customerName: string;
    finalCost: number | null;
    paid?: boolean;
  };
  const custSnap = await db.doc(`customers/${order.customerId}`).get();
  const customer = (custSnap.data() ?? {}) as {
    name?: string;
    email?: string;
    phone?: string;
    type?: string;
    billing?: { taxId?: string };
  };
  const settings = ((await db.doc('settings/global').get()).data() ?? {}) as {
    paymentLinkExpiryHours?: number;
    templates?: { invoiceIssued?: string };
  };
  return { orderRef, order, customer, settings };
}

/** Generate a Morning payment link for an order and store it + its expiry on the order. */
export const createOrderPaymentLink = onCall<{ orderId: string }>(async (req) => {
  const actor = requireStaff(req);
  const { orderId } = req.data ?? {};
  if (!orderId) throw new HttpsError('invalid-argument', 'חסר מזהה הזמנה.');

  const { orderRef, order, customer, settings } = await loadOrderContext(orderId);
  if (order.finalCost == null) {
    throw new HttpsError('failed-precondition', 'לא ניתן ליצור קישור תשלום לפני חישוב עלות.');
  }

  const provider = resolveInvoiceProvider();
  const res = await provider.createPaymentForm({
    amount: order.finalCost,
    description: `תשלום עבור הזמנה #${order.orderNumber}`,
    client: {
      name: customer.name ?? order.customerName,
      emails: customer.email ? [customer.email] : [],
      taxId: customer.billing?.taxId,
    },
    successUrl: `https://whitesheep.example/orders/${orderId}?paid=1`,
    failureUrl: `https://whitesheep.example/orders/${orderId}?paid=0`,
    notifyUrl: `https://whitesheep.example/paymentWebhook?orderId=${orderId}`,
  });
  if (!res.ok || !res.url) {
    throw new HttpsError('internal', `יצירת קישור התשלום נכשלה: ${res.error ?? ''}`);
  }

  const expiryHours = settings.paymentLinkExpiryHours ?? 24;
  const expiresAt = Timestamp.fromMillis(Date.now() + expiryHours * 3600 * 1000);
  await orderRef.update({
    paymentLink: res.url,
    paymentLinkExpiresAt: expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await serverLog(
    actor,
    'financial',
    `נוצר קישור תשלום להזמנה #${order.orderNumber}${res.simulated ? ' (סימולציה)' : ''}`,
  );
  return { url: res.url, expiresAt: expiresAt.toMillis(), simulated: res.simulated ?? false };
});

/**
 * Settle an order's payment. In production this is what the payment provider's webhook
 * (notifyUrl) triggers on a successful charge; here it's callable so the flow is testable.
 * Marks the order paid, issues a חשבונית מס קבלה for PRIVATE customers (Morning) and sends it,
 * and records a row in `payments`. Institutional customers are billed monthly (Module 8).
 */
export const settleOrderPayment = onCall<{ orderId: string }>(async (req) => {
  const actor = requireStaff(req);
  const { orderId } = req.data ?? {};
  if (!orderId) throw new HttpsError('invalid-argument', 'חסר מזהה הזמנה.');

  const { orderRef, order, customer, settings } = await loadOrderContext(orderId);
  if (order.paid) return { alreadyPaid: true };
  if (order.finalCost == null) {
    throw new HttpsError('failed-precondition', 'לא ניתן לסמן כשולם לפני חישוב עלות.');
  }

  const isPrivate = (customer.type ?? 'private') === 'private';
  let invoiceId: string | null = null;
  let invoiceUrl: string | null = null;
  let invoiceSimulated = false;
  let invoiceError: string | undefined;

  if (isPrivate) {
    const provider = resolveInvoiceProvider();
    const docRes = await provider.issueDocument({
      type: DOC_TYPE.TAX_INVOICE_RECEIPT,
      amount: order.finalCost,
      description: `הזמנה #${order.orderNumber} — כביסה`,
      client: {
        name: customer.name ?? order.customerName,
        emails: customer.email ? [customer.email] : [],
        taxId: customer.billing?.taxId,
      },
    });
    if (docRes.ok) {
      invoiceId = docRes.id ?? null;
      invoiceUrl = docRes.url ?? null;
      invoiceSimulated = docRes.simulated ?? false;
      // Send the invoice to the customer by SMS (Morning also emails it to client.emails).
      const tpl =
        settings.templates?.invoiceIssued ??
        'היי [שם הלקוח], קיבלנו את תשלומך על סך [סכום] ש"ח. חשבונית מס קבלה: [קישור למסמך].';
      const body = fillTemplate(tpl, {
        '[שם הלקוח]': customer.name ?? order.customerName,
        '[סכום]': String(order.finalCost),
        '[קישור למסמך]': invoiceUrl ?? '',
      });
      if (customer.phone) await resolveProvider().send(customer.phone, body);
    } else {
      invoiceError = docRes.error;
    }
  }

  await orderRef.update({
    paid: true,
    paidAt: FieldValue.serverTimestamp(),
    invoiceId,
    invoiceUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.collection('payments').add({
    orderId,
    customerId: order.customerId,
    amount: order.finalCost,
    status: 'paid',
    method: 'link',
    invoiceId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const invoiceNote = isPrivate
    ? invoiceId
      ? ` · הופקה ונשלחה חשבונית מס קבלה${invoiceSimulated ? ' (סימולציה)' : ''}`
      : ` · הפקת חשבונית נכשלה${invoiceError ? ': ' + invoiceError : ''}`
    : ' · לקוח מוסדי (חשבונית חודשית מרוכזת — מודול 8)';
  await serverLog(
    actor,
    'financial',
    `תשלום התקבל להזמנה #${order.orderNumber} על סך ${order.finalCost} ש"ח${invoiceNote}`,
  );

  return { paid: true, isPrivate, invoiceId, invoiceUrl, simulated: invoiceSimulated };
});
