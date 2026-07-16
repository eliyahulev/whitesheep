// Firestore data model — TypeScript types for every collection.
// Collections: customers, orders, orderItems, inventoryItems, rentals, payments, auditLog, settings

import type { Timestamp } from 'firebase/firestore';

/** Firestore timestamps may arrive as Timestamp (client) or be written as Date. */
export type TS = Timestamp | Date;

export type Role = 'employee' | 'manager';

export type CustomerType = 'private' | 'institutional';

/** A managed user in the User Management screen (Auth account or pending invite). */
export type AppUserStatus = 'pending' | 'active' | 'unknown';

export interface AppUser {
  email: string;
  role: Role | null; // null → signed in but not authorized
  status: AppUserStatus; // pending = invited, active = has account+role, unknown = no role
  uid: string | null;
  displayName: string | null;
  lastSignInAt: number | null; // epoch ms
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // Israeli mobile, stored normalized e.g. "0521234567"
  email?: string;
  type: CustomerType;
  billing?: {
    taxId?: string; // ח.פ / ת.ז for invoicing
    address?: string;
    contactName?: string;
  };
  /** institutional only: accumulate delivery notes for monthly consolidated invoice (Module 8). */
  monthlyConsolidation?: boolean;
  createdAt: TS;
  updatedAt: TS;
}

/** Service catalog used across orders (Module 1 defines, Module 2 uses). */
export type ServiceType = 'weighed_laundry' | 'ironing' | 'dry_cleaning' | 'rental';

export type OrderStatus =
  | 'received'
  | 'in_progress'
  | 'ready'
  | 'picked_up'
  | 'delivered';

export interface Order {
  id: string;
  orderNumber: number; // human-friendly sequential number (e.g. 1001)
  customerId: string;
  customerName: string; // denormalized for list display
  status: OrderStatus;
  hasPickupDelivery: boolean;
  /** Final cost is null until weighed laundry has been weighed after wash (Module 2). */
  finalCost: number | null;
  expectedReadyAt?: TS;
  paymentLink?: string;
  paymentLinkExpiresAt?: TS;
  paid?: boolean;
  paidAt?: TS;
  invoiceId?: string | null; // Morning document id (private customers)
  invoiceUrl?: string | null; // link to the issued חשבונית מס קבלה PDF
  // Debt engine (Module 5)
  isDebt?: boolean; // payment link expired unpaid → open debt
  debtSince?: TS; // when it became overdue (= expiry time)
  debtReminders?: number; // scheduled reminders sent so far
  lastReminderAt?: TS;
  // Institutional monthly consolidation (Module 8) — a priced institutional order is an open
  // "delivery note" until it's rolled into a monthly invoice.
  consolidatedInvoiceId?: string | null;
  consolidatedAt?: TS;
  createdAt: TS;
  updatedAt: TS;
}

export interface OrderItem {
  id: string;
  orderId: string;
  service: ServiceType;
  /** weighed_laundry: kg (entered after wash). ironing/dry_cleaning: unit count. */
  quantity?: number;
  weightKg?: number;
  unitPrice?: number; // resolved from settings price list at time of pricing
  lineTotal?: number;
  description?: string; // e.g. "10 חולצות"
  // rental lines: linked to a real inventory item + the rental record created on order save
  inventoryItemId?: string;
  rentalId?: string;
  expectedReturnAt?: TS | null;
}

export interface InventoryItem {
  id: string;
  name: string; // e.g. מפות, מפיות, מצעים
  totalQuantity: number;
  availableQuantity: number;
  createdAt: TS;
  updatedAt: TS;
}

export interface Rental {
  id: string;
  customerId: string;
  customerName: string; // denormalized for display
  lines: { inventoryItemId: string; itemName: string; quantity: number }[];
  rentedAt: TS;
  expectedReturnAt: TS;
  returnedAt?: TS | null;
  overdueAlerted?: boolean;
  // set when the rental was created as part of an order (Module 2 rental line)
  orderId?: string;
  orderNumber?: number;
  createdAt: TS;
  updatedAt: TS;
}

export type PaymentStatus = 'pending' | 'paid' | 'paid_manually' | 'debt';

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: PaymentStatus;
  method?: 'link' | 'cash' | 'transfer';
  invoiceId?: string;
  createdAt: TS;
  updatedAt: TS;
}

export type AuditActionType = 'order' | 'inventory' | 'financial' | 'customer' | 'system' | 'auth';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  actionType: AuditActionType;
  description: string;
  createdAt: TS;
}

/** Message templates — Hebrew, verbatim per module. Placeholders use [brackets]. */
export interface MessageTemplates {
  orderDropOff: string;
  orderReadySelfPickup: string;
  orderReadyDelivery: string;
  debtReminder: string;
  rentalOverdueReminder: string;
  invoiceIssued: string;
  monthlyInvoiceIssued: string;
}

export interface Settings {
  prices: {
    weighedLaundryPerKg: number;
    ironingPerItem: number;
    dryCleaningPerItem: number;
  };
  paymentLinkExpiryHours: number; // default 24
  reminderIntervalsDays: number[]; // e.g. [3, 7]
  templates: MessageTemplates;
  integrations: {
    smsProvider: string; // e.g. 'stub' | 'inforu' | 'twilio'
    invoiceProvider: string; // e.g. 'stub' | 'greeninvoice' | 'morning' | 'icount'
  };
}
