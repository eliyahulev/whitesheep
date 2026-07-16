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

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginScreen() {
  const { signIn, signInWithGoogle, deniedEmail } = useAuth();
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

  async function onGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate('/', { replace: true });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/operation-not-allowed'
          ? 'התחברות Google אינה מופעלת עדיין בפרויקט. הפעילו אותה בקונסולת Firebase.'
          : code === 'auth/popup-closed-by-user' || code === 'app/not-authorized'
            ? '' // 'app/not-authorized' is shown via the deniedEmail alert below
            : 'התחברות עם Google נכשלה.',
      );
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

          {deniedEmail && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              החשבון <bdi>{deniedEmail}</bdi> אינו מורשה לגשת למערכת. פנו למנהל להוספת המשתמש.
            </Alert>
          )}

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

          <Divider sx={{ my: 2, color: 'text.secondary', fontSize: 13 }}>או</Divider>

          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            size="large"
            disabled={busy}
            onClick={onGoogle}
            startIcon={<GoogleG />}
          >
            התחברות עם Google
          </Button>

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
