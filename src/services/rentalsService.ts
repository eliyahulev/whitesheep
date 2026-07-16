import {
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { col } from '@/firebase/collections';
import { db, functions } from '@/firebase/config';
import type { Customer, InventoryItem, Rental } from '@/types/models';
import { getCustomer } from './customersService';
import { loadSettings } from './settingsService';
import { getMessagingProvider, type SendResult } from './integrations/messaging';
import { fillTemplate } from './messageTemplates';
import { logAction, type ActingUser } from './logAction';
import { toDate, formatDate } from '@/utils/format';

export interface RentalLineDraft {
  inventoryItemId: string;
  itemName: string;
  quantity: number;
}
export interface RentalDraft {
  lines: RentalLineDraft[];
  rentedAt: Date;
  expectedReturnAt: Date;
}

export function watchRentals(onChange: (rentals: Rental[]) => void): () => void {
  const q = query(col.rentals, orderBy('rentedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rental, 'id'>) })));
  });
}

/** A rental is overdue if it hasn't been returned and its expected return has passed. */
export function isOverdue(r: Rental): boolean {
  if (r.returnedAt) return false;
  const due = toDate(r.expectedReturnAt);
  return !!due && due.getTime() < Date.now();
}

/**
 * Create a rental and atomically decrement each item's availableQuantity.
 * Fails (rolls back) if any line exceeds available stock.
 */
export async function createRental(
  draft: RentalDraft,
  customer: Customer,
  user: ActingUser | null,
): Promise<string> {
  const rentalRef = doc(col.rentals);
  await runTransaction(db, async (tx) => {
    // read all items first (transactions require reads before writes)
    const snaps = await Promise.all(
      draft.lines.map((l) => tx.get(doc(db, 'inventoryItems', l.inventoryItemId))),
    );
    snaps.forEach((snap, i) => {
      const line = draft.lines[i];
      if (!snap.exists()) throw new Error(`פריט המלאי "${line.itemName}" לא נמצא`);
      const it = snap.data() as InventoryItem;
      if (it.availableQuantity < line.quantity) {
        throw new Error(`אין מספיק "${it.name}" במלאי (זמין: ${it.availableQuantity})`);
      }
    });
    snaps.forEach((snap, i) => {
      const line = draft.lines[i];
      const it = snap.data() as InventoryItem;
      tx.update(snap.ref, {
        availableQuantity: it.availableQuantity - line.quantity,
        updatedAt: serverTimestamp(),
      });
    });
    tx.set(rentalRef, {
      customerId: customer.id,
      customerName: customer.name,
      lines: draft.lines,
      rentedAt: Timestamp.fromDate(draft.rentedAt),
      expectedReturnAt: Timestamp.fromDate(draft.expectedReturnAt),
      returnedAt: null,
      overdueAlerted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  const summary = draft.lines.map((l) => `${l.quantity}× ${l.itemName}`).join(', ');
  await logAction(user, 'inventory', `השכרה ל${customer.name}: ${summary}`);
  return rentalRef.id;
}

/** Return a rental to inventory: restore availability + set returnedAt. */
export async function returnRental(rental: Rental, user: ActingUser | null) {
  await runTransaction(db, async (tx) => {
    const rentalRef = doc(db, 'rentals', rental.id);
    const rentalSnap = await tx.get(rentalRef);
    if (!rentalSnap.exists()) throw new Error('השכרה לא נמצאה');
    const r = rentalSnap.data() as Rental;
    if (r.returnedAt) return; // already returned
    const snaps = await Promise.all(
      r.lines.map((l) => tx.get(doc(db, 'inventoryItems', l.inventoryItemId))),
    );
    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const it = snap.data() as InventoryItem;
      const restored = Math.min(it.totalQuantity, it.availableQuantity + r.lines[i].quantity);
      tx.update(snap.ref, { availableQuantity: restored, updatedAt: serverTimestamp() });
    });
    tx.update(rentalRef, {
      returnedAt: serverTimestamp(),
      overdueAlerted: false,
      updatedAt: serverTimestamp(),
    });
  });
  await logAction(user, 'inventory', `החזרת השכרה של ${rental.customerName} למלאי`);
}

/** One-click overdue-return reminder to the customer. */
export async function sendRentalReminder(rental: Rental, user: ActingUser | null): Promise<SendResult> {
  const settings = await loadSettings();
  const customer = await getCustomer(rental.customerId);
  if (!customer) return { ok: false, error: 'הלקוח לא נמצא' };
  const due = toDate(rental.expectedReturnAt);
  const body = fillTemplate(settings.templates.rentalOverdueReminder, {
    '[שם]': customer.name,
    '[תאריך]': due ? formatDate(due) : '',
  });
  const provider = getMessagingProvider(settings.integrations.smsProvider);
  const res = await provider.sendSms(customer.phone, body);
  await logAction(
    user,
    'inventory',
    `תזכורת החזרת השכרה ל${customer.name}: ` +
      (res.ok ? (res.simulated ? 'נשלחה (סימולציה)' : 'נשלחה') : `נכשלה — ${res.error}`),
  );
  return res;
}

export async function runRentalSweep(): Promise<{ flagged: number }> {
  const fn = httpsCallable<Record<string, never>, { flagged: number }>(functions, 'runRentalSweep');
  const res = await fn({});
  return res.data;
}
