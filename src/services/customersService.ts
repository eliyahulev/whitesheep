import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { col } from '@/firebase/collections';
import { db } from '@/firebase/config';
import type { Customer } from '@/types/models';
import { logAction, type ActingUser } from './logAction';
import { normalizePhone } from '@/utils/format';

// Fields the form owns (everything except id/timestamps).
export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

function fromSnap(id: string, data: Record<string, unknown>): Customer {
  return { id, ...(data as Omit<Customer, 'id'>) };
}

/** Live subscription to all customers, name-ordered. Returns an unsubscribe fn. */
export function watchCustomers(onChange: (customers: Customer[]) => void): () => void {
  const q = query(col.customers, orderBy('name'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => fromSnap(d.id, d.data())));
  });
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, 'customers', id));
  return snap.exists() ? fromSnap(snap.id, snap.data()) : null;
}

export async function createCustomer(input: CustomerInput, user: ActingUser | null): Promise<string> {
  const payload = {
    ...input,
    phone: normalizePhone(input.phone),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(col.customers, payload);
  await logAction(user, 'customer', `יצירת לקוח: ${input.name}`);
  return ref.id;
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
  user: ActingUser | null,
): Promise<void> {
  await updateDoc(doc(db, 'customers', id), {
    ...input,
    phone: normalizePhone(input.phone),
    updatedAt: serverTimestamp(),
  });
  await logAction(user, 'customer', `עדכון לקוח: ${input.name}`);
}

export async function deleteCustomer(
  id: string,
  name: string,
  user: ActingUser | null,
): Promise<void> {
  await deleteDoc(doc(db, 'customers', id));
  await logAction(user, 'customer', `מחיקת לקוח: ${name}`);
}

/** Client-side search across name / phone / contact (Firestore has no substring index). */
export function filterCustomers(customers: Customer[], term: string): Customer[] {
  const t = term.trim().toLowerCase();
  if (!t) return customers;
  const digits = t.replace(/\D/g, '');
  return customers.filter((c) => {
    if (c.name.toLowerCase().includes(t)) return true;
    if (c.billing?.contactName?.toLowerCase().includes(t)) return true;
    if (digits && c.phone.includes(digits)) return true;
    if (c.email?.toLowerCase().includes(t)) return true;
    return false;
  });
}
