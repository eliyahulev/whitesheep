import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import { useAuth } from '@/auth/AuthContext';
import { getCustomer, deleteCustomer } from '@/services/customersService';
import type { Customer } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Phone } from '@/ui/Num';

function Field({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Icon name={icon} size={22} color="#0a7d88" />
      <Box>
        <Typography variant="caption" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body1">{value}</Typography>
      </Box>
    </Box>
  );
}

export function CustomerDetailScreen() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getCustomer(id)
      .then(setCustomer)
      .catch(() => setError('טעינת הלקוח נכשלה'));
  }, [id]);

  async function onDelete() {
    if (!id || !customer) return;
    setDeleting(true);
    try {
      await deleteCustomer(id, customer.name, user);
      navigate('/customers', { replace: true });
    } catch {
      setError('מחיקת הלקוח נכשלה');
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (customer === undefined) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (customer === null) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">הלקוח לא נמצא.</Alert>
        <Button variant="outlined" color="inherit" onClick={() => navigate('/customers')}>
          חזרה לרשימה
        </Button>
      </Stack>
    );
  }

  const institutional = customer.type === 'institutional';
  const isManager = user?.role === 'manager';

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 640 }}>
      <Button
        variant="text"
        color="primary"
        startIcon={<Icon name="arrow_forward" size={20} />}
        onClick={() => navigate('/customers')}
        sx={{ alignSelf: 'flex-start', px: 0 }}
      >
        כל הלקוחות
      </Button>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, fontWeight: 700, fontSize: 24 }}>
              {customer.name.trim().charAt(0) || '?'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h2">{customer.name}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                <Tag tone={institutional ? 'purple' : 'neutral'}>
                  {institutional ? 'לקוח מוסדי' : 'לקוח פרטי'}
                </Tag>
                {customer.monthlyConsolidation && <Tag tone="teal">חיוב חודשי מרוכז</Tag>}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Field icon="call" label="טלפון" value={<Phone value={customer.phone} />} />
            {customer.email && <Field icon="mail" label="אימייל" value={<bdi dir="ltr">{customer.email}</bdi>} />}
            {customer.billing?.contactName && (
              <Field icon="person" label="איש קשר" value={customer.billing.contactName} />
            )}
            {customer.billing?.taxId && (
              <Field
                icon="badge"
                label={institutional ? 'ח.פ / ע.מ' : 'ת.ז'}
                value={<bdi dir="ltr">{customer.billing.taxId}</bdi>}
              />
            )}
            {customer.billing?.address && (
              <Field icon="location_on" label="כתובת" value={customer.billing.address} />
            )}
          </Stack>
        </CardContent>
      </Card>

      {institutional && (
        <Card>
          <CardContent>
            <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="h3">תעודות משלוח</Typography>
              <Typography variant="body2">
                הזמנות מתומחרות של לקוח זה מצטברות כתעודות משלוח לחיוב חודשי מרוכז.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Icon name="request_quote" size={20} />}
                onClick={() => navigate('/monthly-invoicing')}
              >
                למסך החיוב החודשי
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Divider />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Icon name="edit" size={20} />}
          onClick={() => navigate(`/customers/${customer.id}/edit`)}
        >
          עריכה
        </Button>
        {isManager && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Icon name="delete" size={20} />}
            onClick={() => setConfirmOpen(true)}
          >
            מחיקה
          </Button>
        )}
      </Box>

      <Dialog open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <DialogTitle>מחיקת לקוח</DialogTitle>
        <DialogContent>
          <DialogContentText>
            למחוק את הלקוח "{customer.name}"? לא ניתן לשחזר פעולה זו.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmOpen(false)} disabled={deleting}>
            ביטול
          </Button>
          <Button color="error" variant="contained" onClick={onDelete} disabled={deleting}>
            {deleting ? 'מוחק…' : 'מחיקה'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
