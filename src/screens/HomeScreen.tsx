import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAuth } from '@/auth/AuthContext';
import { logAction } from '@/services/logAction';
import { Tag } from '@/ui/Tag';
import { Icon } from '@/ui/Icon';

// Module 0 home is a skeleton. The real manager dashboard is Module 9.
export function HomeScreen() {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');

  async function writeTestLog() {
    await logAction(user, 'system', 'רשומת בדיקה מסך הבית');
    setMsg('נרשמה פעולה ביומן הביקורת ✓');
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline">מודול 0 · שלד המערכת</Typography>
        <Typography variant="h1">שלום {user?.displayName || 'משתמש'} 👋</Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              זהו שלד המערכת. מסכי הליבה — לקוחות, הזמנות, השכרות, תשלומים — ייבנו במודולים הבאים,
              על בסיס Material Design ומערכת העיצוב הזו.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption">התפקיד שלך:</Typography>
              <Tag tone={user?.role === 'manager' ? 'teal' : 'neutral'}>
                {user?.role === 'manager' ? 'מנהל' : 'עובד'}
              </Tag>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption">שבבי סטטוס לדוגמה:</Typography>
              <Tag tone="teal-solid">התקבל</Tag>
              <Tag tone="teal">בטיפול</Tag>
              <Tag tone="amber">מוכן</Tag>
              <Tag tone="success">נמסר</Tag>
              <Tag tone="danger">חוב פתוח</Tag>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">בדיקת יומן ביקורת</Typography>
            <Typography variant="body2">
              כל פעולה מהותית נרשמת דרך <code>logAction</code>. לחצו כדי לרשום רשומה לדוגמה.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Icon name="fact_check" size={20} />}
                onClick={() => void writeTestLog()}
              >
                רישום פעולת בדיקה
              </Button>
              <Button variant="outlined" color="inherit" onClick={() => setMsg('')}>
                נקה
              </Button>
            </Box>
            {msg && (
              <Typography sx={{ color: 'success.dark', fontWeight: 700 }}>{msg}</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
