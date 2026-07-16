import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { useAuth } from '@/auth/AuthContext';
import { fetchUsers, inviteUser, setUserRole, removeUser } from '@/services/usersService';
import type { AppUser, AppUserStatus, Role } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag, type TagTone } from '@/ui/Tag';
import { DateTimeText } from '@/ui/Num';

const ROLE_META: Record<Role, { label: string; tone: TagTone }> = {
  manager: { label: 'מנהל', tone: 'teal' },
  employee: { label: 'עובד', tone: 'neutral' },
};

const STATUS_META: Record<AppUserStatus, { label: string; tone: TagTone }> = {
  active: { label: 'פעיל', tone: 'success' },
  pending: { label: 'הזמנה ממתינה', tone: 'amber' },
  unknown: { label: 'ללא הרשאה', tone: 'danger' },
};

export function UsersScreen() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [inviting, setInviting] = useState(false);

  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AppUser | null>(null);
  const [snack, setSnack] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setUsers(await fetchUsers());
    } catch (e) {
      setLoadError((e as { message?: string }).message ?? 'טעינת המשתמשים נכשלה.');
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const order: Record<AppUserStatus, number> = { unknown: 0, pending: 1, active: 2 };
    return [...(users ?? [])].sort(
      (a, b) => order[a.status] - order[b.status] || a.email.localeCompare(b.email),
    );
  }, [users]);

  const myEmail = (me?.email ?? '').toLowerCase();

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) {
      setSnack({ msg: 'כתובת אימייל לא תקינה.', ok: false });
      return;
    }
    setInviting(true);
    try {
      const res = await inviteUser(clean, role);
      setSnack({
        msg:
          res.status === 'active'
            ? `המשתמש ${clean} נוסף והתפקיד הוחל מיד.`
            : `נשלחה הזמנה ל${clean}. התפקיד יופעל בכניסה הראשונה.`,
        ok: true,
      });
      setEmail('');
      setRole('employee');
      await load();
    } catch (err) {
      setSnack({ msg: (err as { message?: string }).message ?? 'הוספת המשתמש נכשלה.', ok: false });
    } finally {
      setInviting(false);
    }
  }

  async function onChangeRole(u: AppUser, next: Role) {
    if (next === u.role) return;
    setBusyEmail(u.email);
    try {
      await setUserRole(u.email, next);
      setSnack({ msg: `התפקיד של ${u.email} עודכן ל${ROLE_META[next].label}.`, ok: true });
      await load();
    } catch (err) {
      setSnack({ msg: (err as { message?: string }).message ?? 'עדכון התפקיד נכשל.', ok: false });
      await load();
    } finally {
      setBusyEmail(null);
    }
  }

  async function onRemove(u: AppUser) {
    setConfirmRemove(null);
    setBusyEmail(u.email);
    try {
      await removeUser(u.email);
      setSnack({ msg: `${u.email} הוסר מהמערכת.`, ok: true });
      await load();
    } catch (err) {
      setSnack({ msg: (err as { message?: string }).message ?? 'הסרת המשתמש נכשלה.', ok: false });
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">ניהול</Typography>
        <Typography variant="h1">משתמשים</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          הוספה, הסרה וניהול תפקידים. רק משתמשים שנוספו כאן יכולים להיכנס למערכת.
        </Typography>
      </Box>

      {/* Invite / add user */}
      <Card>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>הוספת משתמש</Typography>
          <Box
            component="form"
            onSubmit={onInvite}
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr auto' },
              alignItems: 'start',
            }}
          >
            <TextField
              label="אימייל"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
              required
            />
            <TextField select label="תפקיד" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <MenuItem value="employee">עובד</MenuItem>
              <MenuItem value="manager">מנהל</MenuItem>
            </TextField>
            <Button
              type="submit"
              color="secondary"
              variant="contained"
              size="large"
              disabled={inviting}
              startIcon={<Icon name="person_add" size={20} />}
              sx={{ minHeight: 56 }}
            >
              {inviting ? 'מוסיף…' : 'הוספה'}
            </Button>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
            אם למשתמש כבר יש חשבון — התפקיד יוחל מיד. אחרת, ההרשאה תיכנס לתוקף בכניסה הראשונה עם Google.
          </Typography>
        </CardContent>
      </Card>

      {loadError && <Alert severity="error">{loadError}</Alert>}

      {/* Users list */}
      {users === null ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : sorted.length === 0 && !loadError ? (
        <Card>
          <CardContent>
            <Typography variant="body2">אין עדיין משתמשים.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {sorted.map((u) => {
            const isMe = u.email.toLowerCase() === myEmail;
            const busy = busyEmail === u.email;
            const status = STATUS_META[u.status];
            return (
              <Card key={u.email}>
                <CardContent
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', py: 1.5 }}
                >
                  <Icon name="account_circle" size={30} color="#0a7d88" />
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {u.displayName || <bdi dir="ltr">{u.email}</bdi>}
                      </Typography>
                      {isMe && <Tag tone="teal-solid">את/ה</Tag>}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      {u.displayName && (
                        <Typography variant="caption" sx={{ direction: 'ltr' }}>
                          <bdi>{u.email}</bdi>
                        </Typography>
                      )}
                      <Tag tone={status.tone}>{status.label}</Tag>
                      {u.lastSignInAt && (
                        <Typography variant="caption">
                          כניסה אחרונה: <DateTimeText date={new Date(u.lastSignInAt)} />
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      select
                      size="small"
                      label="תפקיד"
                      value={u.role ?? ''}
                      disabled={busy || isMe}
                      onChange={(e) => void onChangeRole(u, e.target.value as Role)}
                      sx={{ minWidth: 120 }}
                    >
                      {u.role === null && (
                        <MenuItem value="" disabled>
                          ללא תפקיד
                        </MenuItem>
                      )}
                      <MenuItem value="employee">עובד</MenuItem>
                      <MenuItem value="manager">מנהל</MenuItem>
                    </TextField>
                    {busy ? (
                      <CircularProgress size={22} />
                    ) : (
                      <IconButton
                        color="error"
                        aria-label="הסרת משתמש"
                        disabled={isMe}
                        onClick={() => setConfirmRemove(u)}
                      >
                        <Icon name="delete" size={22} />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Remove confirmation */}
      <Dialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)}>
        <DialogTitle>הסרת משתמש</DialogTitle>
        <DialogContent>
          <DialogContentText>
            להסיר את <bdi dir="ltr">{confirmRemove?.email}</bdi> מהמערכת? החשבון יימחק והמשתמש לא יוכל
            להתחבר יותר. ניתן להוסיף אותו מחדש בהמשך.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="primary" onClick={() => setConfirmRemove(null)}>
            ביטול
          </Button>
          <Button color="error" variant="contained" onClick={() => confirmRemove && void onRemove(confirmRemove)}>
            הסרה
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.ok ? 'success' : 'error'} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
