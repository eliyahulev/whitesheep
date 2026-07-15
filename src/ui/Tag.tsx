import type { ReactNode } from 'react';

// Signature element: the laundry tag — a punched paper chip pinned to a garment.
// Reused across modules for statuses and categories (order status, customer type, inventory).
export type TagTone = 'wool' | 'accent' | 'sun' | 'danger' | 'success';

export function Tag({ tone = 'wool', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
