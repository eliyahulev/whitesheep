import type { OrderItem } from '@/types/models';
import { serviceLabel } from './serviceCatalog';

// Fill a Hebrew template's [bracketed] placeholders with values.
// e.g. fillTemplate(tpl, { '[שם הלקוח]': 'דנה', '[פירוט הפריטים]': '…' })
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [token, value] of Object.entries(vars)) {
    out = out.split(token).join(value);
  }
  return out;
}

/** Human-readable Hebrew summary of order items for the drop-off message. */
export function summarizeItems(items: Pick<OrderItem, 'service' | 'quantity' | 'description'>[]): string {
  return items
    .map((it) => {
      const label = serviceLabel(it.service);
      if (it.service === 'weighed_laundry') return `${label} (משקל ייקבע לאחר כביסה)`;
      const qty = it.quantity ? `${it.quantity}× ` : '';
      const desc = it.description ? ` ${it.description}` : '';
      return `${qty}${label}${desc}`.trim();
    })
    .join(', ');
}
