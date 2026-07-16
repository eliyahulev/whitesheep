import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useAuth } from '@/auth/AuthContext';
import { watchCustomers } from '@/services/customersService';
import { watchInventory } from '@/services/inventoryService';
import { createOrder, type OrderItemDraft } from '@/services/ordersService';
import { SERVICE_CATALOG, serviceLabel } from '@/services/serviceCatalog';
import type { Customer, InventoryItem, ServiceType } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Num } from '@/ui/Num';
import { formatDate } from '@/utils/format';

export function OrderCreateScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [hasPickupDelivery, setHasPickupDelivery] = useState(false);
  const [expectedReadyAt, setExpectedReadyAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // draft for the "add item" row
  const [svc, setSvc] = useState<ServiceType>('weighed_laundry');
  const [qty, setQty] = useState('1');
  const [desc, setDesc] = useState('');
  // rental-specific draft fields
  const [rentalItem, setRentalItem] = useState<InventoryItem | null>(null);
  const [returnAt, setReturnAt] = useState('');

  useEffect(() => watchCustomers(setCustomers), []);
  useEffect(() => watchInventory(setInventory), []);

  const isRental = svc === 'rental';
  const needsQty = svc === 'ironing' || svc === 'dry_cleaning' || isRental;
  const needsDesc = svc === 'ironing' || svc === 'dry_cleaning';

  const qtyNum = Math.max(1, parseInt(qty, 10) || 1);
  // Units of the selected item already reserved by rental lines in this draft.
  const reservedInDraft = (id: string) =>
    items
      .filter((it) => it.service === 'rental' && it.inventoryItemId === id)
      .reduce((sum, it) => sum + (it.quantity ?? 0), 0);
  const rentalRemaining = rentalItem
    ? rentalItem.availableQuantity - reservedInDraft(rentalItem.id)
    : 0;
  const rentalOverStock = isRental && !!rentalItem && qtyNum > rentalRemaining;
  const canAddRental = !!rentalItem && !!returnAt && !rentalOverStock;

  function addItem() {
    if (isRental) {
      if (!canAddRental || !rentalItem) return;
      setItems((prev) => [
        ...prev,
        {
          service: 'rental',
          inventoryItemId: rentalItem.id,
          itemName: rentalItem.name,
          quantity: qtyNum,
          expectedReturnAt: new Date(returnAt),
        },
      ]);
      setRentalItem(null);
      setQty('1');
      setReturnAt('');
      return;
    }
    const item: OrderItemDraft = { service: svc };
    if (needsQty) item.quantity = qtyNum;
    if (needsDesc && desc.trim()) item.description = desc.trim();
    setItems((prev) => [...prev, item]);
    setQty('1');
    setDesc('');
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSave() {
    setError('');
    if (!customer) return setError('בחרו לקוח');
    if (items.length === 0) return setError('הוסיפו לפחות פריט אחד');
    setSaving(true);
    try {
      const { id } = await createOrder(
        {
          hasPickupDelivery,
          expectedReadyAt: expectedReadyAt ? new Date(expectedReadyAt) : null,
          items,
        },
        customer,
        user,
      );
      navigate(`/orders/${id}`, { replace: true, state: { justCreated: true } });
    } catch (e) {
      // Surface the real reason (e.g. insufficient rental stock) when we have one.
      setError((e as Error)?.message || 'יצירת ההזמנה נכשלה. נסו שוב.');
      setSaving(false);
    }
  }

  function itemText(it: OrderItemDraft): string {
    const label = serviceLabel(it.service);
    if (it.service === 'weighed_laundry') return `${label} · משקל ייקבע לאחר כביסה`;
    const q = it.quantity ? `${it.quantity}× ` : '';
    if (it.service === 'rental') {
      const ret = it.expectedReturnAt ? ` · החזרה עד ${formatDate(it.expectedReturnAt)}` : '';
      return `${q}${it.itemName ?? label}${ret}`;
    }
    return `${q}${label}${it.description ? ` · ${it.description}` : ''}`;
  }

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 640 }}>
      <Box>
        <Typography variant="overline">הזמנות</Typography>
        <Typography variant="h1">הזמנה חדשה</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">לקוח</Typography>
            <Autocomplete
              options={customers}
              value={customer}
              onChange={(_, v) => setCustomer(v)}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText="אין לקוחות"
              renderInput={(params) => <TextField {...params} label="בחרו לקוח" />}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">פריטים</Typography>

            {items.length > 0 && (
              <Stack spacing={1}>
                {items.map((it, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Icon name={SERVICE_CATALOG.find((s) => s.type === it.service)!.icon} size={20} color="#0a7d88" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {itemText(it)}
                    </Typography>
                    <IconButton size="small" onClick={() => removeItem(i)} aria-label="הסר">
                      <Icon name="close" size={18} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider>הוספת פריט</Divider>

            <ToggleButtonGroup
              exclusive
              value={svc}
              onChange={(_, v: ServiceType | null) => v && setSvc(v)}
              color="primary"
              sx={{ flexWrap: 'wrap' }}
            >
              {SERVICE_CATALOG.map((s) => (
                <ToggleButton key={s.type} value={s.type} sx={{ gap: 0.5 }}>
                  <Icon name={s.icon} size={18} />
                  {s.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {svc === 'weighed_laundry' && (
              <Alert severity="info" icon={<Icon name="scale" size={20} />}>
                המשקל (והעלות) ייקבעו לאחר הכביסה, במסך ההזמנה.
              </Alert>
            )}

            {isRental && inventory.length === 0 && (
              <Alert severity="warning" icon={<Icon name="inventory_2" size={20} />}>
                אין פריטי מלאי להשכרה. הוסיפו פריטים במסך "השכרות ומלאי".
              </Alert>
            )}

            {isRental && inventory.length > 0 && (
              <Autocomplete
                options={inventory}
                value={rentalItem}
                onChange={(_, v) => setRentalItem(v)}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                getOptionDisabled={(o) => o.availableQuantity - reservedInDraft(o.id) <= 0}
                noOptionsText="אין פריטים"
                renderOption={(props, o) => {
                  const remaining = o.availableQuantity - reservedInDraft(o.id);
                  return (
                    <li {...props} key={o.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                        <span>{o.name}</span>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          זמין: <Num>{remaining}</Num>
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => <TextField {...params} label="פריט מלאי להשכרה" />}
              />
            )}

            {(needsQty || isRental || needsDesc) && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {needsQty && (
                  <TextField
                    label="כמות"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 110 } }}
                    slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
                  />
                )}
                {isRental && (
                  <TextField
                    label="להחזרה עד"
                    type="date"
                    value={returnAt}
                    onChange={(e) => setReturnAt(e.target.value)}
                    sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
                  />
                )}
                {needsDesc && (
                  <TextField
                    label="תיאור (לדוגמה: חולצות)"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
                  />
                )}
              </Box>
            )}

            <Button
              variant="outlined"
              color="primary"
              fullWidth
              startIcon={<Icon name="add" size={18} />}
              onClick={addItem}
              disabled={isRental && !canAddRental}
              sx={{ minHeight: 48 }}
            >
              הוסף פריט
            </Button>

            {rentalOverStock && (
              <Typography variant="caption" sx={{ color: 'error.main' }}>
                הכמות המבוקשת חורגת מהמלאי הזמין (<Num>{rentalRemaining}</Num>).
              </Typography>
            )}
            {isRental && rentalItem && !rentalOverStock && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                זמין להשכרה: <Num>{rentalRemaining}</Num> יח'.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">אספקה</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={hasPickupDelivery}
                  onChange={(e) => setHasPickupDelivery(e.target.checked)}
                />
              }
              label="איסוף ומשלוח"
            />
            <TextField
              label="צפי מוכנות"
              type="datetime-local"
              value={expectedReadyAt}
              onChange={(e) => setExpectedReadyAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="secondary"
          disabled={saving}
          startIcon={<Icon name="send" size={20} />}
          onClick={onSave}
        >
          {saving ? 'יוצר…' : 'צור הזמנה ושלח קבלה'}
        </Button>
        <Button variant="outlined" color="inherit" onClick={() => navigate('/orders')} disabled={saving}>
          ביטול
        </Button>
      </Box>
    </Stack>
  );
}
