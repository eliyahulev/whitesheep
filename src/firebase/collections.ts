import { collection, doc } from 'firebase/firestore';
import { db } from './config';

// Central collection references so names are never stringly-typed across the app.
export const col = {
  customers: collection(db, 'customers'),
  orders: collection(db, 'orders'),
  orderItems: collection(db, 'orderItems'),
  inventoryItems: collection(db, 'inventoryItems'),
  rentals: collection(db, 'rentals'),
  payments: collection(db, 'payments'),
  auditLog: collection(db, 'auditLog'),
  settings: collection(db, 'settings'),
} as const;

/** The single global settings document. */
export const SETTINGS_DOC_ID = 'global';
export const settingsDocRef = doc(db, 'settings', SETTINGS_DOC_ID);
