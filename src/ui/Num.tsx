import { Bidi } from './Bidi';
import { formatCurrency, formatWeightKg, formatPhone, formatDate, formatDateTime } from '@/utils/format';

// Numeric data renders LTR + tabular inside RTL text. Use these everywhere numbers appear
// so "1,240 ₪" / "12.5 ק\"ג" / "052-1234567" never break bidi.
type NumProps = { children: React.ReactNode; hero?: boolean };

export function Num({ children, hero }: NumProps) {
  return (
    <Bidi>
      <span className={hero ? 'num-hero' : 'num'}>{children}</span>
    </Bidi>
  );
}

export const Money = ({ value, hero }: { value: number; hero?: boolean }) => (
  <Num hero={hero}>{formatCurrency(value)}</Num>
);
export const Weight = ({ kg }: { kg: number }) => <Num>{formatWeightKg(kg)}</Num>;
export const Phone = ({ value }: { value: string }) => <Num>{formatPhone(value)}</Num>;
export const DateText = ({ date }: { date: Date }) => <Num>{formatDate(date)}</Num>;
export const DateTimeText = ({ date }: { date: Date }) => <Num>{formatDateTime(date)}</Num>;
