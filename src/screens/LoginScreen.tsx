import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="login-wrap">
      <div className="card login-card fade-in">
        <div className="login-hero">
          <SheepMark size={56} />
          <h1>כבשה לבנה</h1>
          <span className="tagline">מערכת ניהול מכבסה · התחברות לצוות</span>
        </div>
        <form onSubmit={onSubmit} className="stack">
          {error && <div className="error-banner">{error}</div>}
          <div>
            <label htmlFor="email">אימייל</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password">סיסמה</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>

        {usingEmulator && (
          <div className="hint-users">
            <strong>משתמשי דמו (אמולטור):</strong>
            <br />
            מנהל: <code>manager@demo.test</code> / <code>demo1234</code>
            <br />
            עובד: <code>employee@demo.test</code> / <code>demo1234</code>
          </div>
        )}
      </div>
    </div>
  );
}
