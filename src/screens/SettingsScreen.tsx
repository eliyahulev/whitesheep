import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/auth/AuthContext';
import { loadSettings, updateSettings, clearSettingsCache } from '@/services/settingsService';
import { logAction } from '@/services/logAction';
import type { MessageTemplates, Settings } from '@/types/models';
import { Icon } from '@/ui/Icon';

const TEMPLATE_LABELS: Record<keyof MessageTemplates, string> = {
  orderDropOff: 'קבלה בהפקדת הזמנה',
  orderReadySelfPickup: 'מוכן — איסוף עצמי',
  orderReadyDelivery: 'מוכן — מסירה (כולל עלות + קישור)',
  debtReminder: 'תזכורת חוב',
  rentalOverdueReminder: 'תזכורת החזרת השכרה',
  invoiceIssued: 'חשבונית מס קבלה (לקוח פרטי)',
  monthlyInvoiceIssued: 'חשבונית חודשית מרוכזת (מוסדי)',
};

export function SettingsScreen() {
  const { user } = useAuth();
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  // reminder intervals edited as a comma-separated string
  const [intervalsText, setIntervalsText] = useState('');

  useEffect(() => {
    loadSettings(true)
      .then((s) => {
        setForm(s);
        setIntervalsText(s.reminderIntervalsDays.join(', '));
      })
      .catch(() => setError('טעינת ההגדרות נכשלה'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!form) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const setPrice = (k: keyof Settings['prices'], v: string) =>
    setForm((f) => (f ? { ...f, prices: { ...f.prices, [k]: Number(v) || 0 } } : f));
  const setTemplate = (k: keyof MessageTemplates, v: string) =>
    setForm((f) => (f ? { ...f, templates: { ...f.templates, [k]: v } } : f));
  const setIntegration = (k: keyof Settings['integrations'], v: string) =>
    setForm((f) => (f ? { ...f, integrations: { ...f.integrations, [k]: v } } : f));

  async function onSave() {
    if (!form) return;
    setSaving(true);
    try {
      const intervals = intervalsText
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      await updateSettings({ ...form, reminderIntervalsDays: intervals });
      clearSettingsCache();
      await logAction(user, 'system', 'עודכנו הגדרות המערכת');
      setSnack({ msg: 'ההגדרות נשמרו', severity: 'success' });
    } catch {
      setSnack({ msg: 'שמירת ההגדרות נכשלה', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="overline">מודול 10 · הגדרות</Typography>
        <Typography variant="h1">הגדרות</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          מחירים, תוקף קישורי תשלום, תזכורות ותבניות הודעה — הכל נטען מכאן, שום דבר לא מקודד קשיח.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">מחירון (₪)</Typography>
            <TextField
              label='כביסה במשקל — לק"ג'
              value={form.prices.weighedLaundryPerKg}
              onChange={(e) => setPrice('weighedLaundryPerKg', e.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
            />
            <TextField
              label="גיהוץ — לפריט"
              value={form.prices.ironingPerItem}
              onChange={(e) => setPrice('ironingPerItem', e.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
            />
            <TextField
              label="ניקוי יבש — לפריט"
              value={form.prices.dryCleaningPerItem}
              onChange={(e) => setPrice('dryCleaningPerItem', e.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">תשלומים ותזכורות</Typography>
            <TextField
              label="תוקף קישור תשלום (שעות)"
              value={form.paymentLinkExpiryHours}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, paymentLinkExpiryHours: Number(e.target.value) || 0 } : f))
              }
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
            />
            <TextField
              label="מרווחי תזכורת חוב (ימים, מופרד בפסיקים)"
              value={intervalsText}
              onChange={(e) => setIntervalsText(e.target.value)}
              helperText="לדוגמה: 3, 7"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">תבניות הודעה</Typography>
            {(Object.keys(TEMPLATE_LABELS) as (keyof MessageTemplates)[]).map((k) => (
              <TextField
                key={k}
                label={TEMPLATE_LABELS[k]}
                value={form.templates[k]}
                onChange={(e) => setTemplate(k, e.target.value)}
                multiline
                minRows={2}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">אינטגרציות</Typography>
            <TextField
              label="ספק SMS/וואטסאפ"
              value={form.integrations.smsProvider}
              onChange={(e) => setIntegration('smsProvider', e.target.value)}
              helperText="twilio / stub"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <TextField
              label="ספק חשבוניות"
              value={form.integrations.invoiceProvider}
              onChange={(e) => setIntegration('invoiceProvider', e.target.value)}
              helperText="morning / stub"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <Alert severity="info" icon={<Icon name="lock" size={20} />}>
              מפתחות ה־API (Twilio, Morning) נשמרים בצד השרת (משתני סביבה של הפונקציות), ולא
              במסד הנתונים — מטעמי אבטחה. ניתן לעדכן אותם בהגדרות הפריסה.
            </Alert>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          color="secondary"
          disabled={saving}
          startIcon={<Icon name="save" size={20} />}
          onClick={onSave}
        >
          {saving ? 'שומר…' : 'שמירת הגדרות'}
        </Button>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
