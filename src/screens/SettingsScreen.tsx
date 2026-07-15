import { useEffect, useState } from 'react';
import { loadSettings } from '@/services/settingsService';
import type { Settings } from '@/types/models';
import { Bidi } from '@/ui/Bidi';
import { formatCurrency } from '@/utils/format';

// Read-only settings preview for Module 0 — confirms the settings doc exists and is
// readable through the settings service. The full editable Settings screen is Module 10.
export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => setError('טעינת ההגדרות נכשלה'));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!settings) return <p className="muted">טוען הגדרות…</p>;

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">מודול 0 · תצוגה בלבד</div>
        <h1 className="page-title">הגדרות</h1>
        <p className="page-sub">
          נטען דרך שירות ההגדרות מהמסמך <code className="mono">settings/global</code>. עורך מלא ייבנה
          במודול 10.
        </p>
      </div>

      <div className="card stack">
        <h2 className="section-h">מחירון</h2>
        <div className="muted">
          כביסה במשקל (לק"ג):{' '}
          <Bidi>
            <span className="num">{formatCurrency(settings.prices.weighedLaundryPerKg)}</span>
          </Bidi>
        </div>
        <div className="muted">
          גיהוץ (לפריט):{' '}
          <Bidi>
            <span className="num">{formatCurrency(settings.prices.ironingPerItem)}</span>
          </Bidi>
        </div>
        <div className="muted">
          ניקוי יבש (לפריט):{' '}
          <Bidi>
            <span className="num">{formatCurrency(settings.prices.dryCleaningPerItem)}</span>
          </Bidi>
        </div>
      </div>

      <div className="card stack">
        <h2 className="section-h">תשלומים ותזכורות</h2>
        <div className="muted">
          תוקף קישור תשלום: <Bidi><span className="num">{settings.paymentLinkExpiryHours}</span></Bidi>{' '}
          שעות
        </div>
        <div className="muted">
          מרווחי תזכורת (ימים):{' '}
          <Bidi>
            <span className="num">{settings.reminderIntervalsDays.join(', ')}</span>
          </Bidi>
        </div>
      </div>

      <div className="card stack">
        <h2 className="section-h">תבניות הודעה</h2>
        {Object.entries(settings.templates).map(([key, val]) => (
          <div key={key} className="stack" style={{ gap: 4 }}>
            <span className="tag accent" style={{ alignSelf: 'flex-start' }}>{key}</span>
            <p className="muted" style={{ margin: 0 }}>
              {val}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
