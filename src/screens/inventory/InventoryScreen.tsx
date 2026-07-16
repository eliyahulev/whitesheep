import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/auth/AuthContext';
import { watchInventory, createInventoryItem, updateInventoryTotal } from '@/services/inventoryService';
import {
  watchRentals,
  isOverdue,
  returnRental,
  sendRentalReminder,
  runRentalSweep,
} from '@/services/rentalsService';
import type { InventoryItem, Rental } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Num, DateText } from '@/ui/Num';
import { toDate } from '@/utils/format';

type Snack = { msg: string; severity: 'success' | 'error' } | null;

export function InventoryScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(null);

  // dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editQty, setEditQty] = useState('');

  useEffect(() => watchRentals(setRentals), []);
  useEffect(() => watchInventory(setInventory), []);

  const overdue = useMemo(() => (rentals ?? []).filter(isOverdue), [rentals]);

  async function onReturn(r: Rental) {
    setBusy(r.id);
    try {
      await returnRental(r, user);
      setSnack({ msg: 'ההשכרה הוחזרה למלאי', severity: 'success' });
    } catch (e) {
      setSnack({ msg: (e as Error).message, severity: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function onReminder(r: Rental) {
    setBusy(r.id);
    try {
      const res = await sendRentalReminder(r, user);
      setSnack(
        res.ok
          ? { msg: `תזכורת נשלחה${res.simulated ? ' (סימולציה)' : ''}`, severity: 'success' }
          : { msg: `שליחה נכשלה: ${res.error ?? ''}`, severity: 'error' },
      );
    } finally {
      setBusy(null);
    }
  }

  async function onSweep() {
    setBusy('sweep');
    try {
      const { flagged } = await runRentalSweep();
      setSnack({ msg: `נמצאו ${flagged} החזרות חדשות באיחור`, severity: 'success' });
    } finally {
      setBusy(null);
    }
  }

  async function onAddItem() {
    const qty = Math.max(0, parseInt(newQty, 10) || 0);
    if (!newName.trim() || qty <= 0) return;
    setAddOpen(false);
    await createInventoryItem(newName, qty, user);
    setNewName('');
    setNewQty('');
    setSnack({ msg: 'פריט מלאי נוסף', severity: 'success' });
  }

  async function onSaveTotal() {
    if (!editItem) return;
    const total = Math.max(0, parseInt(editQty, 10) || 0);
    const item = editItem;
    setEditItem(null);
    await updateInventoryTotal(item.id, total, user);
    setSnack({ msg: 'המלאי עודכן', severity: 'success' });
  }

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="h1">השכרות ומלאי</Typography>
      </Box>

      {overdue.length > 0 && (
        <Alert severity="error" icon={<Icon name="warning" size={22} />}>
          <strong>
            <Num>{overdue.length}</Num> החזרות באיחור
          </strong>{' '}
          — יש לטפל בהחזרת הפריטים.
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="השכרות" />
        <Tab label="מלאי" />
      </Tabs>

      {/* ---- Rentals tab ---- */}
      {tab === 0 && (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Icon name="add" size={20} />}
              onClick={() => navigate('/rentals/new')}
            >
              השכרה חדשה
            </Button>
            <Button
              variant="outlined"
              color="primary"
              disabled={busy === 'sweep'}
              startIcon={<Icon name="refresh" size={20} />}
              onClick={onSweep}
            >
              בדיקת איחורים
            </Button>
          </Box>

          {rentals === null ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : rentals.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body2">אין השכרות. צרו השכרה חדשה.</Typography>
              </CardContent>
            </Card>
          ) : (
            rentals.map((r) => {
              const od = isOverdue(r);
              const due = toDate(r.expectedReturnAt);
              return (
                <Card key={r.id} sx={od ? { borderColor: 'error.light', bgcolor: 'error.light' } : undefined}>
                  <CardContent sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700 }}>{r.customerName}</Typography>
                        {r.returnedAt ? (
                          <Tag tone="success">הוחזר</Tag>
                        ) : od ? (
                          <Tag tone="danger">באיחור</Tag>
                        ) : (
                          <Tag tone="teal">מושכר</Tag>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {r.lines.map((l) => `${l.quantity}× ${l.itemName}`).join(', ')}
                      </Typography>
                      {due && (
                        <Typography variant="caption">
                          החזרה צפויה: <DateText date={due} />
                        </Typography>
                      )}
                    </Box>
                    {!r.returnedAt && (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {od && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            disabled={busy === r.id}
                            startIcon={<Icon name="sms" size={18} />}
                            onClick={() => onReminder(r)}
                          >
                            תזכורת
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          disabled={busy === r.id}
                          startIcon={<Icon name="assignment_return" size={18} />}
                          onClick={() => onReturn(r)}
                        >
                          החזרה למלאי
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      )}

      {/* ---- Inventory tab ---- */}
      {tab === 1 && (
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Icon name="add" size={20} />}
            onClick={() => setAddOpen(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            פריט מלאי חדש
          </Button>

          {inventory === null ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : inventory.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body2">אין פריטי מלאי. הוסיפו פריט.</Typography>
              </CardContent>
            </Card>
          ) : (
            inventory.map((it) => {
              const rented = it.totalQuantity - it.availableQuantity;
              const pct = it.totalQuantity ? (rented / it.totalQuantity) * 100 : 0;
              return (
                <Card key={it.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Icon name="chair" size={22} color="#0a7d88" />
                      <Typography sx={{ fontWeight: 700, flex: 1 }}>{it.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        זמין <Num>{it.availableQuantity}</Num> / <Num>{it.totalQuantity}</Num>
                      </Typography>
                      <Button size="small" color="primary" onClick={() => { setEditItem(it); setEditQty(String(it.totalQuantity)); }}>
                        עריכה
                      </Button>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      color={it.availableQuantity === 0 ? 'error' : 'primary'}
                    />
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      )}

      {/* add-inventory dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>פריט מלאי חדש</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="שם הפריט" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <TextField
              label="כמות כוללת"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setAddOpen(false)}>ביטול</Button>
          <Button variant="contained" color="secondary" onClick={onAddItem}>הוספה</Button>
        </DialogActions>
      </Dialog>

      {/* edit-total dialog */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>עדכון מלאי — {editItem?.name}</DialogTitle>
        <DialogContent>
          <TextField
            label="כמות כוללת"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            sx={{ mt: 1 }}
            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditItem(null)}>ביטול</Button>
          <Button variant="contained" color="secondary" onClick={onSaveTotal}>שמירה</Button>
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
