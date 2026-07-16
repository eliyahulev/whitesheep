import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as functionsV1 from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { resolveProvider, type SendResult } from './messaging';
import { resolveInvoiceProvider, DOC_TYPE } from './morning';
import { markExpiredDebts, sendDueReminders } from './debt';
import { markOverdueRentals } from './rentals';
import {
  listAppUsers,
  inviteUser as inviteUserImpl,
  setUserRole as setUserRoleImpl,
  removeUser as removeUserImpl,
  isLastManager,
  emailKey,
  type AppRole,
} from './users';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
initializeApp();
const db = getFirestore();

// Emails that get the `manager` role on first sign-in; everyone else is an `employee`.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'eliyahu.lev@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * On user creation (Google/email+password), assign the role custom claim.
 * Access is invite-only: a user gets in ONLY if they were added first —
 *   1. a pending `users/{email}` invite  → that invite's role, marked active, or
 *   2. an ADMIN_EMAILS bootstrap admin    → manager (so the first admin can get in).
 * Anyone else is assigned role 'none' and denied by the app (see AuthContext).
 */
export const assignRoleOnCreate = functionsV1.auth.user().onCreate(async (user) => {
  const email = (user.email ?? '').toLowerCase();
  let role: 'manager' | 'employee' | 'none' = 'none';

  if (email) {
    const ref = db.collection('users').doc(email);
    const invite = await ref.get();
    if (invite.exists) {
      role = invite.data()?.role === 'manager' ? 'manager' : 'employee';
      await ref.set(
        {
          status: 'active',
          uid: user.uid,
          displayName: user.displayName ?? null,
          lastSignInAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else if (ADMIN_EMAILS.includes(email)) {
      role = 'manager';
      await ref.set({
        email,
        role: 'manager',
        status: 'active',
        uid: user.uid,
        displayName: user.displayName ?? null,
        invitedBy: 'system (bootstrap)',
        lastSignInAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await getAuth().setCustomUserClaims(user.uid, { role });
  console.log(`[assignRoleOnCreate] ${email || user.uid} -> ${role}`);
});

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

function requireManager(req: CallableRequest): { uid: string; name: string } {
  const actor = requireStaff(req);
  if (req.auth?.token.role !== 'manager') {
    throw new HttpsError('permission-denied', 'רק מנהל יכול לנהל משתמשים.');
  }
  return actor;
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

// ============================================================
// Module 5 — debt engine (scheduled + on-demand)
// ============================================================

/** Scheduled sweep: expire unpaid links into debts, then send due reminders. */
export const debtEngine = onSchedule('every 6 hours', async () => {
  const marked = await markExpiredDebts(db);
  const reminded = await sendDueReminders(db);
  console.log(`[debtEngine] marked=${marked} reminded=${reminded}`);
});

/** Manager-only manual trigger (debtors screen "check now"). Runs both sweeps once. */
export const runDebtEngine = onCall(async (req) => {
  const actor = requireStaff(req);
  if (req.auth?.token.role !== 'manager') {
    throw new HttpsError('permission-denied', 'רק מנהל יכול להריץ את מנוע החובות.');
  }
  const marked = await markExpiredDebts(db);
  const reminded = await sendDueReminders(db);
  if (marked || reminded) {
    await serverLog(
      actor,
      'financial',
      `הרצת מנוע חובות: ${marked} חובות חדשים, ${reminded} תזכורות נשלחו`,
    );
  }
  return { marked, reminded };
});

// ============================================================
// Module 6 — rental overdue sweep (scheduled + on-demand)
// ============================================================
export const rentalOverdueSweep = onSchedule('every 6 hours', async () => {
  const flagged = await markOverdueRentals(db);
  console.log(`[rentalOverdueSweep] flagged=${flagged}`);
});

export const runRentalSweep = onCall(async (req) => {
  requireStaff(req);
  const flagged = await markOverdueRentals(db);
  return { flagged };
});

// ============================================================
// Module 8 — institutional monthly consolidated invoicing
// ============================================================

interface DeliveryNote {
  orderNumber: number;
  finalCost: number | null;
  paid?: boolean;
  consolidatedInvoiceId?: string | null;
  createdAt?: Timestamp;
}

/**
 * Collect a customer's open delivery notes (priced institutional orders not yet consolidated
 * or paid), issue ONE monthly consolidated invoice (Morning), mark the notes invoiced, send it.
 * Manager-only. Does not affect the private per-payment flow (Module 4).
 */
export const issueMonthlyInvoice = onCall<{ customerId: string }>(async (req) => {
  const actor = requireStaff(req);
  if (req.auth?.token.role !== 'manager') {
    throw new HttpsError('permission-denied', 'רק מנהל יכול להפיק חשבונית חודשית.');
  }
  const { customerId } = req.data ?? {};
  if (!customerId) throw new HttpsError('invalid-argument', 'חסר מזהה לקוח.');

  const custSnap = await db.doc(`customers/${customerId}`).get();
  const customer = custSnap.data() as
    | { name?: string; email?: string; phone?: string; type?: string; billing?: { taxId?: string } }
    | undefined;
  if (!custSnap.exists || !customer) throw new HttpsError('not-found', 'הלקוח לא נמצא.');
  if (customer.type !== 'institutional') {
    throw new HttpsError('failed-precondition', 'חשבונית חודשית מיועדת ללקוחות מוסדיים בלבד.');
  }

  const ordersSnap = await db.collection('orders').where('customerId', '==', customerId).get();
  const notes = ordersSnap.docs.filter((d) => {
    const o = d.data() as DeliveryNote;
    return o.finalCost != null && !o.consolidatedInvoiceId && o.paid !== true;
  });
  if (notes.length === 0) {
    throw new HttpsError('failed-precondition', 'אין תעודות משלוח פתוחות ללקוח זה.');
  }

  const total = notes.reduce((s, d) => s + ((d.data() as DeliveryNote).finalCost ?? 0), 0);
  const provider = resolveInvoiceProvider();
  const docRes = await provider.issueConsolidated({
    type: DOC_TYPE.TAX_INVOICE,
    client: {
      name: customer.name ?? '',
      emails: customer.email ? [customer.email] : [],
      taxId: customer.billing?.taxId,
    },
    lines: notes.map((d) => {
      const o = d.data() as DeliveryNote;
      return { description: `תעודת משלוח — הזמנה #${o.orderNumber}`, amount: o.finalCost ?? 0 };
    }),
  });
  if (!docRes.ok) {
    throw new HttpsError('internal', `הפקת החשבונית נכשלה: ${docRes.error ?? ''}`);
  }

  // mark each delivery note as invoiced
  const batch = db.batch();
  for (const d of notes) {
    batch.update(d.ref, {
      consolidatedInvoiceId: docRes.id ?? null,
      consolidatedAt: FieldValue.serverTimestamp(),
      paid: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // send it to the customer (Morning also emails it)
  const settings = ((await db.doc('settings/global').get()).data() ?? {}) as {
    templates?: { monthlyInvoiceIssued?: string };
  };
  const tpl =
    settings.templates?.monthlyInvoiceIssued ??
    'היי [שם הלקוח], הופקה חשבונית חודשית מרוכזת על סך [סכום] ש"ח עבור [מספר] תעודות משלוח. למסמך: [קישור למסמך].';
  const body = fillTemplate(tpl, {
    '[שם הלקוח]': customer.name ?? '',
    '[סכום]': String(total),
    '[מספר]': String(notes.length),
    '[קישור למסמך]': docRes.url ?? '',
  });
  if (customer.phone) await resolveProvider().send(customer.phone, body);

  await serverLog(
    actor,
    'financial',
    `חשבונית חודשית מרוכזת ל${customer.name}: ${notes.length} תעודות משלוח, סה"כ ${total} ש"ח` +
      (docRes.simulated ? ' (סימולציה)' : ''),
  );

  return {
    invoiceId: docRes.id,
    invoiceUrl: docRes.url,
    count: notes.length,
    total,
    simulated: docRes.simulated ?? false,
  };
});

// ============================================================
// User management (manager-only) — add / remove / manage users & roles.
// Custom claims can only be set server-side, so all of this runs behind callables.
// ============================================================

const roleLabel = (r: AppRole) => (r === 'manager' ? 'מנהל' : 'עובד');

function requireRole(v: unknown): AppRole {
  if (v !== 'employee' && v !== 'manager') {
    throw new HttpsError('invalid-argument', 'תפקיד לא תקין.');
  }
  return v;
}

function requireEmail(v: unknown): string {
  const email = emailKey(v as string);
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'כתובת אימייל לא תקינה.');
  }
  return email;
}

/** List all users (Auth accounts merged with pending invites). Manager-only. */
export const listUsers = onCall(async (req) => {
  requireManager(req);
  return { users: await listAppUsers(db) };
});

/** Invite / authorize a user with a role. Manager-only. */
export const inviteUser = onCall<{ email: string; role: string }>(async (req) => {
  const actor = requireManager(req);
  const email = requireEmail(req.data?.email);
  const role = requireRole(req.data?.role);
  const res = await inviteUserImpl(db, email, role, actor.name);
  await serverLog(
    actor,
    'system',
    `הוספת משתמש ${email} בתפקיד ${roleLabel(role)}` +
      (res.status === 'active' ? ' (חשבון קיים — התפקיד הוחל מיד)' : ' (הזמנה — יופעל בכניסה הראשונה)'),
  );
  return res;
});

/** Change a user's role. Manager-only; can't change your own or the last manager's. */
export const setUserRole = onCall<{ email: string; role: string }>(async (req) => {
  const actor = requireManager(req);
  const email = requireEmail(req.data?.email);
  const role = requireRole(req.data?.role);
  if (email === emailKey(req.auth?.token.email as string)) {
    throw new HttpsError('failed-precondition', 'אי אפשר לשנות את התפקיד של עצמך.');
  }
  if (role !== 'manager' && (await isLastManager(db, email))) {
    throw new HttpsError('failed-precondition', 'לא ניתן להוריד תפקיד למנהל האחרון במערכת.');
  }
  await setUserRoleImpl(db, email, role);
  await serverLog(actor, 'system', `שינוי תפקיד ל${email} → ${roleLabel(role)}`);
  return { ok: true };
});

/** Remove a user entirely (delete account + doc). Manager-only; not self / last manager. */
export const removeUser = onCall<{ email: string }>(async (req) => {
  const actor = requireManager(req);
  const email = requireEmail(req.data?.email);
  if (email === emailKey(req.auth?.token.email as string)) {
    throw new HttpsError('failed-precondition', 'אי אפשר להסיר את עצמך.');
  }
  if (await isLastManager(db, email)) {
    throw new HttpsError('failed-precondition', 'לא ניתן להסיר את המנהל האחרון במערכת.');
  }
  await removeUserImpl(db, email);
  await serverLog(actor, 'system', `הסרת משתמש ${email}`);
  return { ok: true };
});
