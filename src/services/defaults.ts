import type { Settings } from '@/types/models';

// Default settings seeded into Firestore. Everything here is editable in the
// Settings screen (Module 10) — nothing is hard-coded elsewhere in the app.
// Hebrew message templates are verbatim per the module specs; placeholders in [brackets].
export const DEFAULT_SETTINGS: Settings = {
  prices: {
    weighedLaundryPerKg: 15,
    ironingPerItem: 8,
    dryCleaningPerItem: 25,
  },
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
    monthlyInvoiceIssued:
      'היי [שם הלקוח], הופקה חשבונית חודשית מרוכזת על סך [סכום] ש"ח עבור [מספר] תעודות משלוח. למסמך: [קישור למסמך].',
  },
  integrations: {
    // 'twilio' routes sends through the sendSms Cloud Function (credentials server-side).
    // Without provider credentials the function runs in simulated mode. Use 'stub' for a
    // pure client-side no-op.
    smsProvider: 'twilio',
    invoiceProvider: 'stub',
  },
};
