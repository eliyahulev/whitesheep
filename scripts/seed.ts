/**
 * Seed demo data into the Firebase emulator suite.
 *
 * Prereqs: run `npm run emulators` in another terminal first.
 * Then:    npm run seed
 *
 * Seeds:
 *  - two auth users with role custom claims (manager + employee)
 *  - the settings/global doc with defaults
 *  - a sample audit log entry
 *
 * Business collections (customers/orders/...) are seeded by their own modules.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'whitesheep-demo';

// Point the Admin SDK at the local emulators.
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const DEFAULT_SETTINGS = {
  prices: { weighedLaundryPerKg: 15, ironingPerItem: 8, dryCleaningPerItem: 25 },
  paymentLinkExpiryHours: 24,
  reminderIntervalsDays: [3, 7],
  templates: {
    orderDropOff:
      'היי [שם הלקוח], קיבלנו את ההזמנה שלך במכבסה! הפקדת: [פירוט הפריטים]. צפי מוכנות: [תאריך ושעה]. המשך יום נעים!',
    orderReadySelfPickup:
      'היי [שם הלקוח], הכביסה שלך מוכנה וממתינה לך במכבסה! נתראה בקרוב.',
    orderReadyDelivery:
      'היי [שם הלקוח], הכביסה שלך בדרך חזרה אליך! עלות ההזמנה היא: [עלות כוללת] ש"ח. לצפייה בפרטים ותשלום מהיר: [קישור לתשלום כאן].',
    debtReminder:
      'שלום [שם הלקוח], זוהי תזכורת ידידותית כי קיים חוב פתוח על סך [סכום] ש"ח עבור הזמנה מספר [מספר]. לתשלום מהיר ומאובטח בקישור: [קישור לתשלום].',
    rentalOverdueReminder:
      'היי [שם], תזכורת קטנה לגבי המפות שהשאלת, הן היו אמורות לחזור בתאריך [תאריך]. נשמח לעדכון!',
  },
  integrations: { smsProvider: 'stub', invoiceProvider: 'stub' },
};

const USERS = [
  {
    email: 'manager@demo.test',
    password: 'demo1234',
    displayName: 'רונית מנהלת',
    role: 'manager',
  },
  {
    email: 'employee@demo.test',
    password: 'demo1234',
    displayName: 'דניאל עובד',
    role: 'employee',
  },
];

async function main() {
  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  // 1. Users + role custom claims
  for (const u of USERS) {
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(u.email);
      uid = existing.uid;
      await auth.updateUser(uid, { password: u.password, displayName: u.displayName });
    } catch {
      const created = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      uid = created.uid;
    }
    await auth.setCustomUserClaims(uid, { role: u.role });
    console.log(`✓ user ${u.email} (${u.role})`);
  }

  // 2. Settings doc
  await db.collection('settings').doc('global').set(DEFAULT_SETTINGS);
  console.log('✓ settings/global');

  // 3. Sample audit entry
  await db.collection('auditLog').add({
    userId: 'system',
    userName: 'מערכת',
    actionType: 'system',
    description: 'זריעת נתוני דמו הושלמה',
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('✓ sample auditLog entry');

  console.log('\nSeed complete. Demo logins:');
  console.log('  manager@demo.test / demo1234');
  console.log('  employee@demo.test / demo1234');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
