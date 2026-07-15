import { addDoc, serverTimestamp } from 'firebase/firestore';
import { col } from '@/firebase/collections';
import type { AuditActionType } from '@/types/models';

export interface ActingUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
}

/**
 * Shared audit helper — every material action writes a row to `auditLog`.
 * Usage: await logAction(user, 'order', 'שינה סטטוס הזמנה #123 ל"מוכן"').
 */
export async function logAction(
  user: ActingUser | null,
  actionType: AuditActionType,
  description: string,
): Promise<void> {
  try {
    await addDoc(col.auditLog, {
      userId: user?.uid ?? 'system',
      userName: user?.displayName || user?.email || 'מערכת',
      actionType,
      description,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Never let logging failures break the main flow — surface to console.
    // eslint-disable-next-line no-console
    console.error('[logAction] failed to write audit entry', err);
  }
}
