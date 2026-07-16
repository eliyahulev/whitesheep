import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/auth/AuthContext';
import {
  watchDebtors,
  closeDebt,
  sendManualReminder,
  runDebtEngine,
  type ManualPayMethod,
} from '@/services/debtorsService';
import type { Order } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Money, Num } from '@/ui/Num';
import { toDate } from '@/utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;

export function DebtorsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // orderId or 'engine'
  const [closeFor, setCloseFor] = useState<Order | null>(null);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => watchDebtors(setDebts), []);

  const total = useMemo(() => (debts ?? []).reduce((s, o) => s + (o.finalCost ?? 0), 0), [debts]);

  async function onRunEngine() {
    setBusy('engine');
    try {
      const { marked, reminded } = await runDebtEngine();
      setSnack({
        msg: `נמצאו ${marked} חובות חדשים · נשלחו ${reminded} תזכורות`,
        severity: 'success',
      });
    } catch (e) {
      setSnack({ msg: `הרצת המנוע נכשלה: ${(e as Error).message}`, severity: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function onReminder(order: Order) {
    setBusy(order.id);
    try {
      const res = await sendManualReminder(order, user);
      setSnack(
        res.ok
          ? { msg: `תזכורת נשלחה ללקוח${res.simulated ? ' (סימולציה)' : ''}`, severity: 'success' }
          : { msg: `שליחת התזכורת נכשלה: ${res.error ?? ''}`, severity: 'error' },
      );
    } finally {
      setBusy(null);
    }
  }

  async function onClose(method: ManualPayMethod) {
    if (!closeFor) return;
    const order = closeFor;
    setCloseFor(null);
    setBusy(order.id);
    try {
      await closeDebt(order, method, user);
      setSnack({ msg: `החוב על הזמנה #${order.orderNumber} נסגר`, severity: 'success' });
    } catch (e) {
      setSnack({ msg: `סגירת החוב נכשלה: ${(e as Error).message}`, severity: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack spacing={2} className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="overline">חובות</Typography>
          <Typography variant="h1">חייבים</Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          disabled={busy === 'engine'}
          startIcon={<Icon name="refresh" size={20} />}
          onClick={onRunEngine}
        >
          {busy === 'engine' ? 'בודק…' : 'בדיקה עכשיו'}
        </Button>
      </Box>

      {/* Summary */}
      <Card>
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" sx={{ display: 'block' }}>
              סך החוב הפתוח
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: 'error.main' }}>
              <Money value={total} />
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ display: 'block' }}>
              חייבים פתוחים
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: 'primary.main' }}>
              <Num>{debts?.length ?? 0}</Num>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {debts === null ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : debts.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2">אין חובות פתוחים. 🎉</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {debts.map((o) => {
            const since = toDate(o.debtSince);
            const days = since ? Math.floor((Date.now() - since.getTime()) / DAY_MS) : 0;
            return (
              <Card key={o.id}>
                <CardContent sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography
                        sx={{ fontWeight: 800, cursor: 'pointer' }}
                        onClick={() => navigate(`/orders/${o.id}`)}
                      >
                        הזמנה <bdi dir="ltr" className="num">#{o.orderNumber}</bdi>
                      </Typography>
                      <Tag tone="danger">
                        באיחור <Num>{days}</Num> ימים
                      </Tag>
                      {(o.debtReminders ?? 0) > 0 && (
                        <Tag tone="neutral">
                          <Num>{o.debtReminders}</Num> תזכורות
                        </Tag>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {o.customerName}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: 'error.main', minWidth: 80, textAlign: 'end' }}>
                    <Money value={o.finalCost ?? 0} />
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      disabled={busy === o.id}
                      startIcon={<Icon name="sms" size={18} />}
                      onClick={() => onReminder(o)}
                    >
                      שלח תזכורת
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      disabled={busy === o.id}
                      startIcon={<Icon name="check" size={18} />}
                      onClick={() => setCloseFor(o)}
                    >
                      סגירת חוב
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Close-debt method dialog */}
      <Dialog open={!!closeFor} onClose={() => setCloseFor(null)}>
        <DialogTitle>סגירת חוב — אופן התשלום</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            כיצד שולם החוב על הזמנה{' '}
            <bdi dir="ltr" className="num">#{closeFor?.orderNumber}</bdi>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setCloseFor(null)}>
            ביטול
          </Button>
          <Button onClick={() => onClose('cash')} startIcon={<Icon name="payments" size={18} />}>
            מזומן
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => onClose('transfer')}
            startIcon={<Icon name="account_balance" size={18} />}
          >
            העברה בנקאית
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
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
