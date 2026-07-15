// Israeli-locale formatting + validation helpers.
// Numbers/prices/weights render LTR inside RTL text — use these with <Bidi> (see ui/Bidi.tsx).

/** Israeli mobile: 05x-xxxxxxx (10 digits starting 05). Accepts spaces/dashes on input. */
export function isValidIsraeliMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return /^05\d{8}$/.test(digits);
}

/** Normalize to bare digits for storage, e.g. "0521234567". */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Display as 052-1234567. */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw);
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

export function isValidEmail(raw: string): boolean {
  if (!raw) return true; // email is optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

const ils = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
});

/** e.g. "150 ₪". Wrap in <Bidi> when placing inside Hebrew sentences. */
export function formatCurrency(amount: number): string {
  return ils.format(amount);
}

export function formatWeightKg(kg: number): string {
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(kg)} ק"ג`;
}

/** dd/MM/yyyy */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** dd/MM/yyyy HH:mm (24h) */
export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Convert a Firestore Timestamp | Date | undefined to a JS Date. */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Firestore Timestamp has toDate()
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate();
  return null;
}
