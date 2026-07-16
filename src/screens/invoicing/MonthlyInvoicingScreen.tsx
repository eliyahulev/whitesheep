import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { watchCustomers } from '@/services/customersService';
import { watchOrders } from '@/services/ordersService';
import { issueMonthlyInvoice, isOpenDeliveryNote } from '@/services/monthlyInvoicingService';
import type { Customer, Order } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Money, Num } from '@/ui/Num';

interface Group {
  customer: Customer;
  notes: Order[];
  total: number;
}

export function MonthlyInvoicingScreen() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => watchCustomers(setCustomers), []);
  useEffect(() => watchOrders(setOrders), []);

  const groups = useMemo<Group[]>(() => {
    if (!customers || !orders) return [];
    return customers
      .filter((c) => c.type === 'institutional')
      .map((customer) => {
        const notes = orders.filter((o) => o.customerId === customer.id && isOpenDeliveryNote(o));
        return { customer, notes, total: notes.reduce((s, o) => s + (o.finalCost ?? 0), 0) };
      })
      .filter((g) => g.notes.length > 0);
  }, [customers, orders]);

  async function consolidate(g: Group) {
    setBusy(g.customer.id);
    try {
      const res = await issueMonthlyInvoice(g.customer.id);
      setSnack({
        msg: `הופקה חשבונית חודשית: ${res.count} תעודות · ${res.total} ש"ח${res.simulated ? ' (סימולציה)' : ''}`,
        severity: 'success',
      });
    } catch (e) {
      setSnack({ msg: `ההפקה נכשלה: ${(e as Error).message}`, severity: 'error' });
    } finally {
      setBusy(null);
    }
  }

  const loading = customers === null || orders === null;

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">חיוב מוסדי</Typography>
        <Typography variant="h1">חיוב חודשי</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          תעודות משלוח פתוחות מצטברות ללקוחות מוסדיים. בלחיצה אחת מפיקים חשבונית מרוכזת אחת.
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2">אין תעודות משלוח פתוחות לחיוב. 🎉</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {groups.map((g) => (
            <Card key={g.customer.id}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Icon name="apartment" size={22} color="#0a7d88" />
                  <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 140 }}>
                    {g.customer.name}
                  </Typography>
                  <Tag tone="purple">
                    <Num>{g.notes.length}</Num> תעודות משלוח
                  </Tag>
                  <Typography sx={{ fontWeight: 800, color: 'primary.main' }}>
                    <Money value={g.total} />
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={0.5}>
                  {g.notes.map((o) => (
                    <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        תעודת משלוח — הזמנה <bdi dir="ltr" className="num">#{o.orderNumber}</bdi>
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        <Money value={o.finalCost ?? 0} />
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    disabled={busy === g.customer.id}
                    startIcon={<Icon name="request_quote" size={20} />}
                    onClick={() => consolidate(g)}
                  >
                    {busy === g.customer.id ? 'מפיק…' : 'הפק חשבונית חודשית'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

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
