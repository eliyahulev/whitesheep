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
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

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
    invoiceIssued:
      'היי [שם הלקוח], קיבלנו את תשלומך על סך [סכום] ש"ח. חשבונית מס קבלה: [קישור למסמך]. תודה שבחרת בנו!',
  },
  integrations: { smsProvider: 'twilio', invoiceProvider: 'stub' },
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

  // 3. Demo customers (both types)
  const now = FieldValue.serverTimestamp();
  const customers = [
    {
      name: 'משפחת כהן',
      phone: '0521234567',
      email: 'cohen@example.com',
      type: 'private',
      billing: { taxId: '039123456', contactName: '', address: 'הרצל 15, תל אביב' },
      monthlyConsolidation: false,
    },
    {
      name: 'דנה לוי',
      phone: '0549876543',
      email: '',
      type: 'private',
      billing: { taxId: '', contactName: '', address: '' },
      monthlyConsolidation: false,
    },
    {
      name: 'מלון הגליל',
      phone: '0501112233',
      email: 'orders@galil-hotel.co.il',
      type: 'institutional',
      billing: { taxId: '514789632', contactName: 'רועי מנהל תפעול', address: 'שדרות הים 1, נהריה' },
      monthlyConsolidation: true,
    },
    {
      name: 'גן אירועים להב',
      phone: '0533344556',
      email: 'info@lahav-events.co.il',
      type: 'institutional',
      billing: { taxId: '515963258', contactName: 'מיכל רכזת', address: 'מושב להב' },
      monthlyConsolidation: true,
    },
  ];
  const idByName: Record<string, string> = {};
  for (const c of customers) {
    const ref = await db.collection('customers').add({ ...c, createdAt: now, updatedAt: now });
    idByName[c.name] = ref.id;
  }
  console.log(`✓ ${customers.length} demo customers`);

  // 3b. Demo orders + items + order-number counter
  const P = { kg: 15, iron: 8, dry: 25 };
  async function addOrder(o: {
    orderNumber: number;
    customerName: string;
    status: string;
    hasPickupDelivery: boolean;
    finalCost: number | null;
    items: Record<string, unknown>[];
    extra?: Record<string, unknown>;
  }) {
    const ref = await db.collection('orders').add({
      orderNumber: o.orderNumber,
      customerId: idByName[o.customerName],
      customerName: o.customerName,
      status: o.status,
      hasPickupDelivery: o.hasPickupDelivery,
      finalCost: o.finalCost,
      createdAt: now,
      updatedAt: now,
      ...(o.extra ?? {}),
    });
    for (const it of o.items) await db.collection('orderItems').add({ orderId: ref.id, ...it });
  }
  const DAY = 86_400_000;
  const daysAgo = (n: number) => Timestamp.fromMillis(Date.now() - n * DAY);
  // #1001 — weighed laundry, not yet weighed → no final cost
  await addOrder({
    orderNumber: 1001,
    customerName: 'משפחת כהן',
    status: 'received',
    hasPickupDelivery: false,
    finalCost: null,
    items: [{ service: 'weighed_laundry', unitPrice: P.kg }],
  });
  // #1002 — ironing + dry cleaning, in progress, pickup & delivery → cost computed
  await addOrder({
    orderNumber: 1002,
    customerName: 'מלון הגליל',
    status: 'in_progress',
    hasPickupDelivery: true,
    finalCost: 10 * P.iron + 3 * P.dry,
    items: [
      { service: 'ironing', quantity: 10, description: 'חולצות', unitPrice: P.iron, lineTotal: 10 * P.iron },
      { service: 'dry_cleaning', quantity: 3, description: 'חליפות', unitPrice: P.dry, lineTotal: 3 * P.dry },
    ],
  });
  // #1003 — DEBT CANDIDATE: unpaid, payment link expired 2 days ago (not yet a debt).
  // The debt engine should mark this as an open debt.
  await addOrder({
    orderNumber: 1003,
    customerName: 'משפחת כהן',
    status: 'ready',
    hasPickupDelivery: false,
    finalCost: 25 * P.iron, // 200
    items: [{ service: 'ironing', quantity: 25, description: 'מפות', unitPrice: P.iron, lineTotal: 200 }],
    extra: {
      paid: false,
      paymentLink: 'https://pay.sandbox.example/form/1003',
      paymentLinkExpiresAt: daysAgo(2),
    },
  });
  // #1004 — OPEN DEBT, overdue 5 days → a scheduled reminder is due (interval[0]=3).
  await addOrder({
    orderNumber: 1004,
    customerName: 'דנה לוי',
    status: 'ready',
    hasPickupDelivery: false,
    finalCost: 40 * P.iron, // 320
    items: [{ service: 'ironing', quantity: 40, description: 'מפיות', unitPrice: P.iron, lineTotal: 320 }],
    extra: {
      paid: false,
      paymentLink: 'https://pay.sandbox.example/form/1004',
      paymentLinkExpiresAt: daysAgo(6),
      isDebt: true,
      debtSince: daysAgo(5),
      debtReminders: 0,
    },
  });
  await db.collection('counters').doc('orders').set({ next: 1004 });
  console.log('✓ 4 demo orders (+ order counter)');

  // 3c. Inventory items + rentals (one active, one overdue)
  const inv = [
    { name: 'מפות שולחן', total: 55, rented: 20 },
    { name: 'מפיות בד', total: 140, rented: 40 },
    { name: 'מצעים', total: 60, rented: 10 },
  ];
  const invId: Record<string, string> = {};
  for (const it of inv) {
    const ref = await db.collection('inventoryItems').add({
      name: it.name,
      totalQuantity: it.total,
      availableQuantity: it.total - it.rented,
      createdAt: now,
      updatedAt: now,
    });
    invId[it.name] = ref.id;
  }
  const daysFromNow = (n: number) => Timestamp.fromMillis(Date.now() + n * DAY);
  // active rental (returns in 5 days)
  await db.collection('rentals').add({
    customerId: idByName['מלון הגליל'],
    customerName: 'מלון הגליל',
    lines: [{ inventoryItemId: invId['מפות שולחן'], itemName: 'מפות שולחן', quantity: 20 }],
    rentedAt: daysAgo(2),
    expectedReturnAt: daysFromNow(5),
    returnedAt: null,
    overdueAlerted: false,
    createdAt: now,
    updatedAt: now,
  });
  // OVERDUE rental (was due 3 days ago, not returned)
  await db.collection('rentals').add({
    customerId: idByName['גן אירועים להב'],
    customerName: 'גן אירועים להב',
    lines: [
      { inventoryItemId: invId['מפיות בד'], itemName: 'מפיות בד', quantity: 40 },
      { inventoryItemId: invId['מצעים'], itemName: 'מצעים', quantity: 10 },
    ],
    rentedAt: daysAgo(12),
    expectedReturnAt: daysAgo(3),
    returnedAt: null,
    overdueAlerted: false,
    createdAt: now,
    updatedAt: now,
  });
  console.log('✓ 3 inventory items + 2 rentals (1 overdue)');

  // 4. Sample audit entry
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
