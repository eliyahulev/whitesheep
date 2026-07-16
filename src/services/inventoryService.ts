import {
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { col } from '@/firebase/collections';
import { db } from '@/firebase/config';
import type { InventoryItem } from '@/types/models';
import { logAction, type ActingUser } from './logAction';

export function watchInventory(onChange: (items: InventoryItem[]) => void): () => void {
  const q = query(col.inventoryItems, orderBy('name'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) })));
  });
}

export async function createInventoryItem(name: string, totalQuantity: number, user: ActingUser | null) {
  await addDoc(col.inventoryItems, {
    name: name.trim(),
    totalQuantity,
    availableQuantity: totalQuantity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAction(user, 'inventory', `פריט מלאי חדש: ${name} (${totalQuantity} יח')`);
}

/**
 * Update an item's total quantity, adjusting availability by the same delta so the
 * currently-rented count is preserved (available never goes below 0).
 */
export async function updateInventoryTotal(
  id: string,
  newTotal: number,
  user: ActingUser | null,
) {
  const name = await runTransaction(db, async (tx) => {
    const ref = doc(db, 'inventoryItems', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('פריט לא נמצא');
    const it = snap.data() as InventoryItem;
    const delta = newTotal - it.totalQuantity;
    const available = Math.max(0, it.availableQuantity + delta);
    tx.update(ref, { totalQuantity: newTotal, availableQuantity: available, updatedAt: serverTimestamp() });
    return it.name;
  });
  await logAction(user, 'inventory', `עודכן מלאי "${name}": סה"כ ${newTotal} יח'`);
}
