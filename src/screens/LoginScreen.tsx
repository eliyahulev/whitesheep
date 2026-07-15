import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useAuth } from '@/auth/AuthContext';
import { usingEmulator } from '@/firebase/config';
import { SheepMark } from '@/ui/SheepMark';

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch {
      setError('התחברות נכשלה. בדקו את האימייל והסיסמה.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box className="login-backdrop">
      <Card className="fade-in" sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 3.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 3 }}>
            <SheepMark size={56} />
            <Typography variant="h2" sx={{ mt: 0.5 }}>
              כבשה לבנה
            </Typography>
            <Typography variant="body2">מערכת ניהול מכבסה · התחברות לצוות</Typography>
          </Box>

          <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="אימייל"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <TextField
              label="סיסמה"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <Button type="submit" variant="contained" color="primary" size="large" disabled={busy}>
              {busy ? 'מתחבר…' : 'כניסה'}
            </Button>
          </Box>

          {usingEmulator && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
              <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.8 }}>
                <strong>משתמשי דמו (אמולטור):</strong>
                <br />
                מנהל: <code className="num">manager@demo.test</code> / <code className="num">demo1234</code>
                <br />
                עובד: <code className="num">employee@demo.test</code> / <code className="num">demo1234</code>
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
