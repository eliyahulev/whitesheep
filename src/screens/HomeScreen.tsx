import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { logAction } from '@/services/logAction';
import { Tag } from '@/ui/Tag';

// Module 0 home is a skeleton. The real manager dashboard is Module 9.
export function HomeScreen() {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');

  async function writeTestLog() {
    await logAction(user, 'system', 'רשומת בדיקה מסך הבית');
    setMsg('נרשמה פעולה ביומן הביקורת ✓');
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">מודול 0 · שלד המערכת</div>
        <h1 className="page-title">שלום {user?.displayName || 'משתמש'} 👋</h1>
      </div>

      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          זהו שלד המערכת. מסכי הליבה — לקוחות, הזמנות, השכרות, תשלומים — ייבנו במודולים הבאים,
          אחד־אחד.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>התפקיד שלך:</span>
          <Tag tone={user?.role === 'manager' ? 'accent' : 'wool'}>
            {user?.role === 'manager' ? 'מנהל' : 'עובד'}
          </Tag>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          הניווט מוצג בהתאם להרשאות. תגית הכביסה שלמעלה היא רכיב חוזר בכל המערכת — לסטטוסים,
          לסוגי לקוחות ולמלאי.
        </p>
      </div>

      <div className="card stack">
        <h2 className="section-h">בדיקת יומן ביקורת</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          כל פעולה מהותית נרשמת דרך <code className="mono">logAction</code>. לחצו כדי לרשום רשומה
          לדוגמה.
        </p>
        <div>
          <button className="btn secondary" onClick={() => void writeTestLog()}>
            רישום פעולת בדיקה
          </button>
        </div>
        {msg && (
          <p style={{ color: 'var(--success)', margin: 0, fontWeight: 600 }}>{msg}</p>
        )}
      </div>
    </div>
  );
}
