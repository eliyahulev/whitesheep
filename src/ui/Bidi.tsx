import type { ReactNode } from 'react';

// Bidi isolation wrapper — renders numbers/prices/weights/phones LTR inside RTL text
// so "150 ש\"ח" and "052-1234567" never break. Uses the native <bdi> element.
export function Bidi({ children, dir = 'ltr' }: { children: ReactNode; dir?: 'ltr' | 'rtl' }) {
  return <bdi dir={dir}>{children}</bdi>;
}
