import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import { useAuth } from '@/auth/AuthContext';
import { watchOrders, STATUS_LABEL, STATUS_TONE } from '@/services/ordersService';
import { watchRentals, isOverdue } from '@/services/rentalsService';
import { watchDebtors } from '@/services/debtorsService';
import { watchInventory } from '@/services/inventoryService';
import type { InventoryItem, Order, Rental } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Money, Num } from '@/ui/Num';

function DashCard({
  title,
  icon,
  to,
  children,
  navigate,
}: {
  title: string;
  icon: string;
  to: string;
  children: React.ReactNode;
  navigate: (to: string) => void;
}) {
  return (
    <Card>
      <CardActionArea onClick={() => navigate(to)} sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Icon name={icon} size={22} color="#0a7d88" />
            <Typography variant="h3" sx={{ flex: 1 }}>
              {title}
            </Typography>
            <Icon name="chevron_left" size={20} color="#a9b7b9" />
          </Box>
          {children}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function HomeScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager';

  const [orders, setOrders] = useState<Order[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [debts, setDebts] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => watchOrders(setOrders), []);
  useEffect(() => watchRentals(setRentals), []);
  useEffect(() => watchInventory(setInventory), []);
  useEffect(() => {
    if (!isManager) return; // debtors are manager-only
    return watchDebtors(setDebts);
  }, [isManager]);

  const openByStatus = useMemo(() => {
    const counts = { received: 0, in_progress: 0, ready: 0 };
    for (const o of orders) if (o.status in counts) counts[o.status as keyof typeof counts]++;
    return counts;
  }, [orders]);
  const openTotal = openByStatus.received + openByStatus.in_progress + openByStatus.ready;

  const overdueRentals = useMemo(() => rentals.filter(isOverdue), [rentals]);
  const debtTotal = useMemo(() => debts.reduce((s, o) => s + (o.finalCost ?? 0), 0), [debts]);

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">לוח בקרה</Typography>
        <Typography variant="h1">שלום {user?.displayName || 'משתמש'} 👋</Typography>
      </Box>

      {overdueRentals.length > 0 && (
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
            <Num>{overdueRentals.length}</Num> החזרות השכרה באיחור
          </AlertTitle>
          {overdueRentals.map((r) => r.customerName).join(', ')}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        {/* Open orders by status */}
        <DashCard title="הזמנות פתוחות" icon="receipt_long" to="/orders" navigate={navigate}>
          <Typography sx={{ fontSize: 34, fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>
            <Num>{openTotal}</Num>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
            {(['received', 'in_progress', 'ready'] as const).map((s) => (
              <Tag key={s} tone={STATUS_TONE[s]}>
                {STATUS_LABEL[s]} · <Num>{openByStatus[s]}</Num>
              </Tag>
            ))}
          </Box>
        </DashCard>

        {/* Debtors (manager only) */}
        {isManager && (
          <DashCard title="חייבים" icon="account_balance_wallet" to="/debtors" navigate={navigate}>
            <Typography sx={{ fontSize: 34, fontWeight: 800, color: 'error.main', lineHeight: 1 }}>
              <Money value={debtTotal} />
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <Num>{debts.length}</Num> חייבים פתוחים
            </Typography>
            {debts.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={0.5}>
                  {debts.slice(0, 3).map((o) => (
                    <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{o.customerName}</Typography>
                      <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700 }}>
                        <Money value={o.finalCost ?? 0} />
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </DashCard>
        )}

        {/* Overdue returns */}
        <DashCard title="החזרות השכרה" icon="assignment_return" to="/inventory" navigate={navigate}>
          {overdueRentals.length === 0 ? (
            <Typography variant="body2">אין החזרות באיחור. 🎉</Typography>
          ) : (
            <>
              <Typography sx={{ fontSize: 34, fontWeight: 800, color: 'error.main', lineHeight: 1 }}>
                <Num>{overdueRentals.length}</Num>
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                באיחור: {overdueRentals.map((r) => r.customerName).join(', ')}
              </Typography>
            </>
          )}
        </DashCard>

        {/* Inventory availability */}
        <DashCard title="מלאי" icon="inventory_2" to="/inventory" navigate={navigate}>
          {inventory.length === 0 ? (
            <Typography variant="body2">אין פריטי מלאי.</Typography>
          ) : (
            <Stack spacing={1}>
              {inventory.map((it) => {
                const rented = it.totalQuantity - it.availableQuantity;
                const pct = it.totalQuantity ? (rented / it.totalQuantity) * 100 : 0;
                return (
                  <Box key={it.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {it.name}
                      </Typography>
                      <Typography variant="caption">
                        זמין <Num>{it.availableQuantity}</Num> / <Num>{it.totalQuantity}</Num>
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                      color={it.availableQuantity === 0 ? 'error' : 'primary'}
                    />
                  </Box>
                );
              })}
            </Stack>
          )}
        </DashCard>
      </Box>
    </Stack>
  );
}
