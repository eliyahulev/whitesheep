import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/auth/AuthContext';
import {
  watchOrder,
  watchOrderItems,
  advanceStatus,
  setItemWeight,
  nextStatuses,
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_FLOW,
} from '@/services/ordersService';
import { SERVICE_BY_TYPE, serviceLabel } from '@/services/serviceCatalog';
import { createPaymentLink, settlePayment } from '@/services/paymentsService';
import type { Order, OrderItem } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Money, Num } from '@/ui/Num';
import { toDate, formatDateTime } from '@/utils/format';

function WeighRow({ order, item, user }: { order: Order; item: OrderItem; user: ReturnType<typeof useAuth>['user'] }) {
  const [kg, setKg] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const v = parseFloat(kg);
    if (!v || v <= 0) return;
    setBusy(true);
    try {
      await setItemWeight(order, item, v, user);
    } finally {
      setBusy(false);
      setKg('');
    }
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        label='משקל (ק"ג)'
        size="small"
        value={kg}
        onChange={(e) => setKg(e.target.value)}
        sx={{ width: 130 }}
        slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
      />
      <Button
        variant="contained"
        color="secondary"
        size="small"
        disabled={busy}
        startIcon={<Icon name="scale" size={18} />}
        onClick={save}
      >
        שקילה
      </Button>
    </Box>
  );
}

export function OrderDetailScreen() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;

  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyPay, setBusyPay] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    if (!id) return;
    const u1 = watchOrder(id, setOrder);
    const u2 = watchOrderItems(id, setItems);
    return () => {
      u1();
      u2();
    };
  }, [id]);

  if (order === undefined) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (order === null) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">ההזמנה לא נמצאה.</Alert>
        <Button variant="outlined" color="inherit" onClick={() => navigate('/orders')}>
          חזרה
        </Button>
      </Stack>
    );
  }

  const readyAt = toDate(order.expectedReadyAt);
  const nexts = nextStatuses(order);
  // sorted so weighed-laundry-pending appears first
  const sortedItems = [...items].sort((a, b) =>
    a.service === 'weighed_laundry' ? -1 : b.service === 'weighed_laundry' ? 1 : 0,
  );

  async function advance(to: Order['status']) {
    if (!order) return;
    setBusyStatus(true);
    try {
      const res = await advanceStatus(order, to, user);
      if (!res.ok && res.blocked) {
        setSnack({ msg: res.blocked, severity: 'warning' });
      } else if (res.message) {
        setSnack(
          res.message.ok
            ? {
                msg: res.message.simulated
                  ? 'הודעת מוכנות נשלחה ללקוח (סימולציה — ללא ספק אמיתי)'
                  : 'הודעת מוכנות נשלחה ללקוח',
                severity: 'success',
              }
            : { msg: `שליחת ההודעה נכשלה: ${res.message.error ?? ''}`, severity: 'error' },
        );
      }
    } finally {
      setBusyStatus(false);
    }
  }

  async function genLink() {
    if (!order) return;
    setBusyPay(true);
    try {
      const res = await createPaymentLink(order.id);
      setSnack({
        msg: res.simulated ? 'קישור תשלום נוצר (סימולציה — ללא ספק אמיתי)' : 'קישור תשלום נוצר',
        severity: 'success',
      });
    } catch (e) {
      setSnack({ msg: `יצירת קישור התשלום נכשלה: ${(e as Error).message}`, severity: 'error' });
    } finally {
      setBusyPay(false);
    }
  }

  async function payNow() {
    if (!order) return;
    setBusyPay(true);
    try {
      const res = await settlePayment(order.id);
      setSnack(
        res.isPrivate
          ? {
              msg: res.invoiceId
                ? `התשלום התקבל · הופקה חשבונית מס קבלה${res.simulated ? ' (סימולציה)' : ''}`
                : 'התשלום התקבל · הפקת החשבונית נכשלה',
              severity: res.invoiceId ? 'success' : 'error',
            }
          : { msg: 'התשלום התקבל · לקוח מוסדי (חשבונית חודשית מרוכזת)', severity: 'success' },
      );
    } catch (e) {
      setSnack({ msg: `סימון התשלום נכשל: ${(e as Error).message}`, severity: 'error' });
    } finally {
      setBusyPay(false);
    }
  }

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 640 }}>
      <Button
        variant="text"
        color="primary"
        startIcon={<Icon name="arrow_forward" size={20} />}
        onClick={() => navigate('/orders')}
        sx={{ alignSelf: 'flex-start', px: 0 }}
      >
        כל ההזמנות
      </Button>

      {justCreated && (
        <Alert severity="success" icon={<Icon name="check_circle" size={20} />}>
          ההזמנה נוצרה. נשלחה ללקוח הודעת קבלה.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h2">
              הזמנה <bdi dir="ltr" className="num">#{order.orderNumber}</bdi>
            </Typography>
            <Tag tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Tag>
            {order.hasPickupDelivery && <Tag tone="purple">איסוף ומשלוח</Tag>}
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {order.customerName}
            {readyAt ? ` · צפי מוכנות: ${formatDateTime(readyAt)}` : ''}
          </Typography>
        </CardContent>
      </Card>

      {/* Lifecycle + next-action buttons */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {STATUS_FLOW.map((s, i) => {
                const idx = STATUS_FLOW.indexOf(order.status);
                const done = idx >= i && idx !== -1;
                return (
                  <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon
                      name={done ? 'check_circle' : 'radio_button_unchecked'}
                      fill={done}
                      size={20}
                      color={done ? '#0a7d88' : '#a9b7b9'}
                    />
                    <Typography variant="body2" sx={{ fontWeight: order.status === s ? 700 : 500 }}>
                      {STATUS_LABEL[s]}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            {nexts.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {nexts.map((s) => (
                  <Button
                    key={s}
                    variant="contained"
                    color="secondary"
                    disabled={busyStatus}
                    startIcon={<Icon name="arrow_back" size={18} />}
                    onClick={() => advance(s)}
                  >
                    סמן כ״{STATUS_LABEL[s]}״
                  </Button>
                ))}
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">פריטים</Typography>
            {sortedItems.map((it) => {
              const def = SERVICE_BY_TYPE[it.service];
              const pending = it.service === 'weighed_laundry' && it.weightKg == null;
              return (
                <Box key={it.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Icon name={def.icon} size={22} color="#0a7d88" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{serviceLabel(it.service)}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {it.service === 'weighed_laundry'
                          ? it.weightKg != null
                            ? <>משקל: <Num>{it.weightKg}</Num> ק"ג</>
                            : 'ממתין לשקילה'
                          : it.quantity
                            ? <><Num>{it.quantity}</Num>× {it.description || ''}</>
                            : it.description || ''}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'end' }}>
                      {it.lineTotal != null ? <Money value={it.lineTotal} /> : <Typography variant="caption" className="muted">—</Typography>}
                    </Box>
                  </Box>
                  {pending && (
                    <Box sx={{ mt: 1, paddingInlineStart: '38px' }}>
                      <WeighRow order={order} item={it} user={user} />
                    </Box>
                  )}
                </Box>
              );
            })}

            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700 }}>עלות סופית</Typography>
              {order.finalCost == null ? (
                <Tag tone="amber">ממתין לשקילה</Tag>
              ) : (
                <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'primary.main' }}>
                  <Money value={order.finalCost} />
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Payment & invoice (Module 4) */}
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h3">תשלום</Typography>
              {order.paid && <Tag tone="success">שולם</Tag>}
            </Box>

            {order.finalCost == null ? (
              <Typography variant="body2">יש להזין משקל ולחשב עלות לפני יצירת קישור תשלום.</Typography>
            ) : order.paid ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  התקבל תשלום על סך <Money value={order.finalCost} />.
                </Typography>
                {order.invoiceUrl && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Icon name="receipt" size={20} />}
                    href={order.invoiceUrl}
                    target="_blank"
                    rel="noopener"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    צפייה בחשבונית מס קבלה
                  </Button>
                )}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {order.paymentLink ? (
                  <>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      נוצר קישור תשלום
                      {toDate(order.paymentLinkExpiresAt)
                        ? ` · בתוקף עד ${formatDateTime(toDate(order.paymentLinkExpiresAt)!)}`
                        : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<Icon name="open_in_new" size={18} />}
                        href={order.paymentLink}
                        target="_blank"
                        rel="noopener"
                      >
                        פתיחת קישור התשלום
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        disabled={busyPay}
                        startIcon={<Icon name="payments" size={18} />}
                        onClick={payNow}
                      >
                        דמו: סימון כשולם
                      </Button>
                    </Box>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    color="secondary"
                    disabled={busyPay}
                    startIcon={<Icon name="link" size={20} />}
                    onClick={genLink}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {busyPay ? 'יוצר…' : 'צור קישור תשלום'}
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
