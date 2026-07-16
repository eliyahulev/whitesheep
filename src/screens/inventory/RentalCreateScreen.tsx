import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useAuth } from '@/auth/AuthContext';
import { watchCustomers } from '@/services/customersService';
import { watchInventory } from '@/services/inventoryService';
import { createRental, type RentalLineDraft } from '@/services/rentalsService';
import type { Customer, InventoryItem } from '@/types/models';
import { Icon } from '@/ui/Icon';

function localInput(date: Date): string {
  const off = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - off).toISOString().slice(0, 16);
}

export function RentalCreateScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<RentalLineDraft[]>([]);
  const [rentedAt, setRentedAt] = useState(localInput(new Date()));
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => watchCustomers(setCustomers), []);
  useEffect(() => watchInventory(setInventory), []);

  function addLine() {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const q = Math.max(1, parseInt(qty, 10) || 1);
    setLines((prev) => {
      const existing = prev.find((l) => l.inventoryItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.inventoryItemId === item.id ? { ...l, quantity: l.quantity + q } : l,
        );
      }
      return [...prev, { inventoryItemId: item.id, itemName: item.name, quantity: q }];
    });
    setItemId('');
    setQty('1');
  }

  async function onSave() {
    setError('');
    if (!customer) return setError('בחרו לקוח');
    if (lines.length === 0) return setError('הוסיפו לפחות פריט אחד');
    if (!expectedReturnAt) return setError('בחרו תאריך החזרה צפוי');
    setSaving(true);
    try {
      const id = await createRental(
        {
          lines,
          rentedAt: rentedAt ? new Date(rentedAt) : new Date(),
          expectedReturnAt: new Date(expectedReturnAt),
        },
        customer,
        user,
      );
      navigate('/inventory', { replace: true, state: { rentalId: id } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 640 }}>
      <Box>
        <Typography variant="overline">מודול 6 · השכרות</Typography>
        <Typography variant="h1">השכרה חדשה</Typography>
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
            <Typography variant="h3">פריטים להשכרה</Typography>

            {lines.length > 0 && (
              <Stack spacing={1}>
                {lines.map((l, i) => (
                  <Box
                    key={l.inventoryItemId}
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
                    <Icon name="chair" size={20} color="#0a7d88" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {l.quantity}× {l.itemName}
                    </Typography>
                    <IconButton size="small" aria-label="הסר" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                      <Icon name="close" size={18} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            <Divider>הוספת פריט</Divider>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                select
                label="פריט"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                sx={{ flex: 1, minWidth: 180 }}
              >
                {inventory.length === 0 && <MenuItem disabled>אין פריטי מלאי</MenuItem>}
                {inventory.map((it) => (
                  <MenuItem key={it.id} value={it.id} disabled={it.availableQuantity <= 0}>
                    {it.name} (זמין {it.availableQuantity})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="כמות"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                sx={{ width: 100 }}
                slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
              />
              <Button
                variant="outlined"
                color="primary"
                disabled={!itemId}
                startIcon={<Icon name="add" size={18} />}
                onClick={addLine}
                sx={{ minHeight: 56 }}
              >
                הוסף
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">תאריכים</Typography>
            <TextField
              label="תאריך השכרה"
              type="datetime-local"
              value={rentedAt}
              onChange={(e) => setRentedAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
            />
            <TextField
              label="החזרה צפויה"
              type="datetime-local"
              value={expectedReturnAt}
              onChange={(e) => setExpectedReturnAt(e.target.value)}
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
          startIcon={<Icon name="check" size={20} />}
          onClick={onSave}
        >
          {saving ? 'שומר…' : 'צור השכרה'}
        </Button>
        <Button variant="outlined" color="inherit" onClick={() => navigate('/inventory')} disabled={saving}>
          ביטול
        </Button>
      </Box>
    </Stack>
  );
}
