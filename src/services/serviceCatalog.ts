import type { ServiceType } from '@/types/models';

// The service catalog used across the app (orders in Module 2, rentals in Module 6).
// Defined here so labels/icons/units are consistent everywhere.
export interface ServiceDef {
  type: ServiceType;
  label: string; // Hebrew
  icon: string; // Material Symbols name
  /** unit of quantity for pricing */
  unit: 'kg' | 'item' | 'rental';
  unitLabel: string; // Hebrew, e.g. 'לק"ג'
  /** settings key on settings.prices, when applicable */
  priceKey?: 'weighedLaundryPerKg' | 'ironingPerItem' | 'dryCleaningPerItem';
}

export const SERVICE_CATALOG: ServiceDef[] = [
  {
    type: 'weighed_laundry',
    label: 'כביסה במשקל',
    icon: 'local_laundry_service',
    unit: 'kg',
    unitLabel: 'לק"ג',
    priceKey: 'weighedLaundryPerKg',
  },
  {
    type: 'ironing',
    label: 'גיהוץ',
    icon: 'iron',
    unit: 'item',
    unitLabel: 'לפריט',
    priceKey: 'ironingPerItem',
  },
  {
    type: 'dry_cleaning',
    label: 'ניקוי יבש',
    icon: 'dry_cleaning',
    unit: 'item',
    unitLabel: 'לפריט',
    priceKey: 'dryCleaningPerItem',
  },
  {
    type: 'rental',
    label: 'השכרת ציוד',
    icon: 'chair',
    unit: 'rental',
    unitLabel: 'להשכרה',
  },
];

export const SERVICE_BY_TYPE: Record<ServiceType, ServiceDef> = Object.fromEntries(
  SERVICE_CATALOG.map((s) => [s.type, s]),
) as Record<ServiceType, ServiceDef>;

export const serviceLabel = (t: ServiceType): string => SERVICE_BY_TYPE[t]?.label ?? t;
