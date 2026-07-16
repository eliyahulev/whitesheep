import { type Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Rental overdue sweep (Module 6). Flags rentals whose expected return has passed and
// that haven't been returned, and logs each once. The dashboard/UI surfaces the alert.

interface RentalDoc {
  customerName: string;
  expectedReturnAt?: Timestamp;
  returnedAt?: Timestamp | null;
  overdueAlerted?: boolean;
}

async function systemLog(db: Firestore, description: string) {
  await db.collection('auditLog').add({
    userId: 'system',
    userName: 'מערכת',
    actionType: 'inventory',
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Mark not-yet-alerted rentals whose expected return has passed and aren't returned. */
export async function markOverdueRentals(db: Firestore): Promise<number> {
  const now = Timestamp.now();
  const snap = await db.collection('rentals').where('expectedReturnAt', '<=', now).get();
  let flagged = 0;
  for (const docSnap of snap.docs) {
    const r = docSnap.data() as RentalDoc;
    if (r.returnedAt || r.overdueAlerted === true) continue;
    await docSnap.ref.update({ overdueAlerted: true, updatedAt: FieldValue.serverTimestamp() });
    await systemLog(db, `החזרה באיחור: השכרה של ${r.customerName} לא הוחזרה במועד`);
    flagged++;
  }
  return flagged;
}
