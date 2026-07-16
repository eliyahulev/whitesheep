import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { useAuth } from '@/auth/AuthContext';
import { logAction } from '@/services/logAction';
import { watchRentals, isOverdue } from '@/services/rentalsService';
import type { Rental } from '@/types/models';
import { Tag } from '@/ui/Tag';
import { Icon } from '@/ui/Icon';
import { Num } from '@/ui/Num';

// Module 0 home is a skeleton. The real manager dashboard is Module 9.
export function HomeScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [rentals, setRentals] = useState<Rental[]>([]);

  useEffect(() => watchRentals(setRentals), []);
  const overdue = useMemo(() => rentals.filter(isOverdue), [rentals]);

  async function writeTestLog() {
    await logAction(user, 'system', 'רשומת בדיקה מסך הבית');
    setMsg('נרשמה פעולה ביומן הביקורת ✓');
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline">בית</Typography>
        <Typography variant="h1">שלום {user?.displayName || 'משתמש'} 👋</Typography>
      </Box>

      {overdue.length > 0 && (
        <Alert
          severity="error"
          icon={<Icon name="warning" size={22} />}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/inventory')}>
              לטיפול
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 800, mb: 0 }}>
            <Num>{overdue.length}</Num> החזרות השכרה באיחור
          </AlertTitle>
          פריטים שהיו אמורים לחזור ולא הוחזרו.
        </Alert>
      )}

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
