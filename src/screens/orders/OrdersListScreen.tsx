import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { watchOrders, STATUS_LABEL, STATUS_TONE } from '@/services/ordersService';
import type { Order, OrderStatus } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Money } from '@/ui/Num';
import { toDate, formatDate } from '@/utils/format';

const FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'received', label: 'התקבל' },
  { value: 'in_progress', label: 'בטיפול' },
  { value: 'ready', label: 'מוכן' },
  { value: 'delivered', label: 'נמסר/נאסף' },
];

export function OrdersListScreen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => watchOrders(setOrders), []);

  const results = useMemo(() => {
    if (!orders) return [];
    if (filter === 'all') return orders;
    if (filter === 'delivered') return orders.filter((o) => o.status === 'delivered' || o.status === 'picked_up');
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <Stack spacing={2} className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h1">הזמנות</Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Icon name="add" size={20} />}
          onClick={() => navigate('/orders/new')}
        >
          הזמנה חדשה
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            onClick={() => setFilter(f.value)}
            color={filter === f.value ? 'primary' : 'default'}
            variant={filter === f.value ? 'filled' : 'outlined'}
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Box>

      {orders === null ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : results.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2">
              {filter === 'all' ? 'אין עדיין הזמנות. צרו הזמנה חדשה.' : 'אין הזמנות בסטטוס זה.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {results.map((o) => {
            const created = toDate(o.createdAt);
            return (
              <Card key={o.id}>
                <CardActionArea onClick={() => navigate(`/orders/${o.id}`)}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 800 }}>
                          הזמנה <bdi dir="ltr" className="num">#{o.orderNumber}</bdi>
                        </Typography>
                        <Tag tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Tag>
                        {o.hasPickupDelivery && <Tag tone="purple">איסוף ומשלוח</Tag>}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {o.customerName}
                        {created ? ` · ${formatDate(created)}` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'end' }}>
                      {o.finalCost == null ? (
                        <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 700 }}>
                          ממתין לשקילה
                        </Typography>
                      ) : (
                        <Typography sx={{ fontWeight: 800, color: 'primary.main' }}>
                          <Money value={o.finalCost} />
                        </Typography>
                      )}
                    </Box>
                    <Icon name="chevron_left" size={22} color="#a9b7b9" />
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
