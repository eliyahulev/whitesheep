import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { col } from '@/firebase/collections';
import { db } from '@/firebase/config';
import type { Customer, Order, OrderItem, OrderStatus, ServiceType } from '@/types/models';
import { loadSettings } from './settingsService';
import { getMessagingProvider, type SendResult } from './integrations/messaging';
import { getCustomer } from './customersService';
import { logAction, type ActingUser } from './logAction';
import { fillTemplate, summarizeItems } from './messageTemplates';
import { formatDateTime } from '@/utils/format';
import type { TagTone } from '@/ui/Tag';

const nis = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });

/** Placeholder checkout link — a real payment link + expiry is generated in Module 4. */
export function paymentLinkPlaceholder(order: Order): string {
  return `https://pay.example.com/o/${order.id}`;
}

// --- Draft shapes used by the create form ---
export interface OrderItemDraft {
  service: ServiceType;
  quantity?: number; // ironing / dry_cleaning
  description?: string;
}
export interface OrderDraft {
  hasPickupDelivery: boolean;
  expectedReadyAt: Date | null;
  items: OrderItemDraft[];
}

type Prices = Awaited<ReturnType<typeof loadSettings>>['prices'];

/** Resolve unit price + line total for an item. Weighed laundry has no line total until weighed. */
function priceItem(
  draft: OrderItemDraft,
  prices: Prices,
): Pick<OrderItem, 'service' | 'quantity' | 'description' | 'unitPrice' | 'lineTotal' | 'weightKg'> {
  switch (draft.service) {
    case 'weighed_laundry':
      return { service: 'weighed_laundry', unitPrice: prices.weighedLaundryPerKg }; // lineTotal after weighing
    case 'ironing':
      return {
        service: 'ironing',
        quantity: draft.quantity ?? 1,
        description: draft.description,
        unitPrice: prices.ironingPerItem,
        lineTotal: (draft.quantity ?? 1) * prices.ironingPerItem,
      };
    case 'dry_cleaning':
      return {
        service: 'dry_cleaning',
        quantity: draft.quantity ?? 1,
        description: draft.description,
        unitPrice: prices.dryCleaningPerItem,
        lineTotal: (draft.quantity ?? 1) * prices.dryCleaningPerItem,
      };
    case 'rental':
      // Placeholder — full rental pricing is Module 6.
      return { service: 'rental', description: draft.description, lineTotal: 0 };
  }
}

/** Final cost = sum of line totals, or null while any weighed-laundry line is still unweighed. */
export function computeFinalCost(items: OrderItem[]): number | null {
  const pendingWeigh = items.some((i) => i.service === 'weighed_laundry' && i.weightKg == null);
  if (pendingWeigh) return null;
  return items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);
}

function toDate(v: Date | null): Timestamp | null {
  return v ? Timestamp.fromDate(v) : null;
}

/** Create an order (+ items) with a sequential number, then trigger the drop-off message (stub). */
export async function createOrder(
  draft: OrderDraft,
  customer: Customer,
  user: ActingUser | null,
): Promise<{ id: string; orderNumber: number }> {
  const settings = await loadSettings();
  const priced = draft.items.map((d) => priceItem(d, settings.prices));
  const pendingWeigh = priced.some((i) => i.service === 'weighed_laundry');
  const finalCost = pendingWeigh
    ? null
    : priced.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);

  const orderRef = doc(col.orders);
  const counterRef = doc(db, 'counters', 'orders');

  // Reserve the next sequential number atomically.
  const orderNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = ((snap.exists() ? (snap.data().next as number) : 1000) || 1000) + 1;
    tx.set(counterRef, { next }, { merge: true });
    return next;
  });

  // Write the order + its items together so they can't get out of sync.
  const batch = writeBatch(db);
  batch.set(orderRef, {
    orderNumber,
    customerId: customer.id,
    customerName: customer.name,
    status: 'received' as OrderStatus,
    hasPickupDelivery: draft.hasPickupDelivery,
    finalCost,
    expectedReadyAt: toDate(draft.expectedReadyAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  for (const item of priced) {
    batch.set(doc(col.orderItems), { orderId: orderRef.id, ...item });
  }
  await batch.commit();

  // Drop-off message (stubbed provider for now — real provider is Module 3).
  const body = fillTemplate(settings.templates.orderDropOff, {
    '[שם הלקוח]': customer.name,
    '[פירוט הפריטים]': summarizeItems(priced),
    '[תאריך ושעה]': draft.expectedReadyAt ? formatDateTime(draft.expectedReadyAt) : 'יעודכן',
  });
  const provider = getMessagingProvider(settings.integrations.smsProvider);
  const res = await provider.sendSms(customer.phone, body);
  const sendNote = res.ok
    ? res.simulated
      ? ' · נשלחה הודעת קבלה (סימולציה)'
      : ' · נשלחה הודעת קבלה'
    : ` · שליחת הודעת הקבלה נכשלה — ${res.error ?? ''}`;
  await logAction(user, 'order', `יצירת הזמנה #${orderNumber} עבור ${customer.name}${sendNote}`);

  return { id: orderRef.id, orderNumber };
}

export function watchOrders(onChange: (orders: Order[]) => void): () => void {
  const q = query(col.orders, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
  });
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Order, 'id'>) }) : null;
}

/** Live single-order subscription. Calls onChange(null) if the order doesn't exist. */
export function watchOrder(id: string, onChange: (order: Order | null) => void): () => void {
  return onSnapshot(doc(db, 'orders', id), (snap) => {
    onChange(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) } : null);
  });
}

export function watchOrderItems(orderId: string, onChange: (items: OrderItem[]) => void): () => void {
  const q = query(col.orderItems, where('orderId', '==', orderId));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderItem, 'id'>) })));
  });
}

async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const snap = await getDocs(query(col.orderItems, where('orderId', '==', orderId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderItem, 'id'>) }));
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'התקבל',
  in_progress: 'בטיפול',
  ready: 'מוכן',
  picked_up: 'נאסף',
  delivered: 'נמסר',
};

export const STATUS_TONE: Record<OrderStatus, TagTone> = {
  received: 'teal-solid',
  in_progress: 'teal',
  ready: 'amber',
  picked_up: 'success',
  delivered: 'success',
};

/** The ordered lifecycle for display as a stepper/timeline. */
export const STATUS_FLOW: OrderStatus[] = ['received', 'in_progress', 'ready'];

/** Allowed next statuses from the current one (terminal statuses have none). */
export function nextStatuses(order: Order): OrderStatus[] {
  switch (order.status) {
    case 'received':
      return ['in_progress'];
    case 'in_progress':
      return ['ready'];
    case 'ready':
      return [order.hasPickupDelivery ? 'delivered' : 'picked_up'];
    default:
      return [];
  }
}

export async function setStatus(order: Order, next: OrderStatus, user: ActingUser | null) {
  await updateDoc(doc(db, 'orders', order.id), { status: next, updatedAt: serverTimestamp() });
  await logAction(
    user,
    'order',
    `שינוי סטטוס הזמנה #${order.orderNumber}: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[next]}`,
  );
}

/**
 * Send the "ready" message via the configured provider:
 *  - self-pickup → "your laundry is ready"
 *  - pickup & delivery → "on its way", with the exact final cost + payment link.
 * Every send (success or failure) is logged; the result is returned to surface in the UI.
 */
export async function sendReadyMessage(order: Order, user: ActingUser | null): Promise<SendResult> {
  const settings = await loadSettings();
  const customer = await getCustomer(order.customerId);
  if (!customer) return { ok: false, error: 'הלקוח לא נמצא' };

  let body: string;
  if (order.hasPickupDelivery) {
    if (order.finalCost == null) {
      return { ok: false, error: 'אין לשלוח הודעת מסירה לפני שקילה וחישוב עלות' };
    }
    body = fillTemplate(settings.templates.orderReadyDelivery, {
      '[שם הלקוח]': customer.name,
      '[עלות כוללת]': nis.format(order.finalCost),
      // use the real Morning link if one was generated (Module 4), else a placeholder
      '[קישור לתשלום כאן]': order.paymentLink ?? paymentLinkPlaceholder(order),
    });
  } else {
    body = fillTemplate(settings.templates.orderReadySelfPickup, {
      '[שם הלקוח]': customer.name,
    });
  }

  const provider = getMessagingProvider(settings.integrations.smsProvider);
  const res = await provider.sendSms(customer.phone, body);
  const kind = order.hasPickupDelivery ? 'מסירה' : 'איסוף עצמי';
  await logAction(
    user,
    'order',
    `הודעת מוכנות (${kind}) להזמנה #${order.orderNumber}: ` +
      (res.ok ? (res.simulated ? 'נשלחה (סימולציה)' : 'נשלחה') : `נכשלה — ${res.error}`),
  );
  return res;
}

export interface AdvanceResult {
  ok: boolean;
  blocked?: string; // reason the transition was refused
  message?: SendResult; // present when a "ready" message was attempted
}

/** Advance status; on reaching "ready", send the appropriate ready message. */
export async function advanceStatus(
  order: Order,
  next: OrderStatus,
  user: ActingUser | null,
): Promise<AdvanceResult> {
  if (next === 'ready' && order.hasPickupDelivery && order.finalCost == null) {
    return {
      ok: false,
      blocked: 'יש להזין משקל ולחשב עלות לפני סימון כ״מוכן״ (הודעת המסירה כוללת את העלות).',
    };
  }
  await setStatus(order, next, user);
  if (next === 'ready') {
    const message = await sendReadyMessage({ ...order, status: 'ready' }, user);
    return { ok: true, message };
  }
  return { ok: true };
}

/** Enter weight for a weighed-laundry item → set its line total and recompute the order's final cost. */
export async function setItemWeight(
  order: Order,
  item: OrderItem,
  weightKg: number,
  user: ActingUser | null,
) {
  const lineTotal = weightKg * (item.unitPrice ?? 0);
  await updateDoc(doc(db, 'orderItems', item.id), { weightKg, lineTotal });

  const items = await fetchOrderItems(order.id);
  const merged = items.map((i) => (i.id === item.id ? { ...i, weightKg, lineTotal } : i));
  const finalCost = computeFinalCost(merged);
  await updateDoc(doc(db, 'orders', order.id), { finalCost, updatedAt: serverTimestamp() });

  await logAction(
    user,
    'order',
    `שקילת כביסה בהזמנה #${order.orderNumber}: ${weightKg} ק"ג`,
  );
}
