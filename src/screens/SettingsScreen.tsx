import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import { loadSettings } from '@/services/settingsService';
import type { Settings } from '@/types/models';
import { Tag } from '@/ui/Tag';
import { Money, Num } from '@/ui/Num';

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

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!settings) return <Typography variant="body2">טוען הגדרות…</Typography>;

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">מודול 0 · תצוגה בלבד</Typography>
        <Typography variant="h1">הגדרות</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          נטען דרך שירות ההגדרות מהמסמך <code>settings/global</code>. עורך מלא ייבנה במודול 10.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">מחירון</Typography>
            <Typography variant="body2">
              כביסה במשקל (לק"ג): <Money value={settings.prices.weighedLaundryPerKg} />
            </Typography>
            <Typography variant="body2">
              גיהוץ (לפריט): <Money value={settings.prices.ironingPerItem} />
            </Typography>
            <Typography variant="body2">
              ניקוי יבש (לפריט): <Money value={settings.prices.dryCleaningPerItem} />
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">תשלומים ותזכורות</Typography>
            <Typography variant="body2">
              תוקף קישור תשלום: <Num>{settings.paymentLinkExpiryHours}</Num> שעות
            </Typography>
            <Typography variant="body2">
              מרווחי תזכורת (ימים): <Num>{settings.reminderIntervalsDays.join(', ')}</Num>
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">תבניות הודעה</Typography>
            {Object.entries(settings.templates).map(([key, val]) => (
              <Box
                key={key}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}
              >
                <Tag tone="teal">{key}</Tag>
                <Typography variant="body2">{val}</Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
