import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { col } from '@/firebase/collections';
import type { AuditLogEntry } from '@/types/models';

/** Live audit-log feed, newest first (bounded). Manager-only per Firestore rules. */
export function watchAuditLog(
  onChange: (entries: AuditLogEntry[]) => void,
  max = 500,
): () => void {
  const q = query(col.auditLog, orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) })));
  });
}
