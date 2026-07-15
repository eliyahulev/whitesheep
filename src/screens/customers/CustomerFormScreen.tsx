import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/auth/AuthContext';
import {
  createCustomer,
  getCustomer,
  updateCustomer,
  type CustomerInput,
} from '@/services/customersService';
import type { CustomerType } from '@/types/models';
import { isValidEmail, isValidIsraeliMobile } from '@/utils/format';
import { Icon } from '@/ui/Icon';

const EMPTY: CustomerInput = {
  name: '',
  phone: '',
  email: '',
  type: 'private',
  billing: { taxId: '', address: '', contactName: '' },
  monthlyConsolidation: false,
};

type Errors = Partial<Record<'name' | 'phone' | 'email', string>>;

export function CustomerFormScreen() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return;
    getCustomer(id)
      .then((c) => {
        if (!c) return setLoadError('הלקוח לא נמצא');
        setForm({
          name: c.name,
          phone: c.phone,
          email: c.email ?? '',
          type: c.type,
          billing: { taxId: '', address: '', contactName: '', ...c.billing },
          monthlyConsolidation: c.monthlyConsolidation ?? false,
        });
      })
      .catch(() => setLoadError('טעינת הלקוח נכשלה'))
      .finally(() => setLoading(false));
  }, [id]);

  function setField<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setBilling(key: keyof NonNullable<CustomerInput['billing']>, value: string) {
    setForm((f) => ({ ...f, billing: { ...f.billing, [key]: value } }));
  }

  function validate(): boolean {
    const e: Errors = {};
    if (!form.name.trim()) e.name = 'שם הוא שדה חובה';
    if (!isValidIsraeliMobile(form.phone)) e.phone = 'מספר טלפון נייד לא תקין (05x-xxxxxxx)';
    if (form.email && !isValidEmail(form.email)) e.email = 'כתובת אימייל לא תקינה';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: CustomerInput = {
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || '',
        monthlyConsolidation: form.type === 'institutional' ? form.monthlyConsolidation : false,
      };
      if (isEdit && id) {
        await updateCustomer(id, payload, user);
        navigate(`/customers/${id}`, { replace: true });
      } else {
        const newId = await createCustomer(payload, user);
        navigate(`/customers/${newId}`, { replace: true });
      }
    } catch {
      setLoadError('שמירת הלקוח נכשלה. נסו שוב.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const institutional = form.type === 'institutional';

  return (
    <Stack spacing={2} className="fade-in" sx={{ maxWidth: 640 }}>
      <Box>
        <Typography variant="overline">מודול 1 · לקוחות</Typography>
        <Typography variant="h1">{isEdit ? 'עריכת לקוח' : 'לקוח חדש'}</Typography>
      </Box>

      {loadError && <Alert severity="error">{loadError}</Alert>}

      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h3">פרטים</Typography>
                <TextField
                  label="שם"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                  autoFocus
                />
                <TextField
                  label="טלפון נייד"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  error={!!errors.phone}
                  helperText={errors.phone || 'לדוגמה: 052-1234567'}
                  required
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'tel' } }}
                />
                <TextField
                  label="אימייל (לא חובה)"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  error={!!errors.email}
                  helperText={errors.email}
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'email' } }}
                />
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                    סוג לקוח
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={form.type}
                    onChange={(_, v: CustomerType | null) => v && setField('type', v)}
                    color="primary"
                  >
                    <ToggleButton value="private">פרטי</ToggleButton>
                    <ToggleButton value="institutional">מוסדי</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h3">פרטי חיוב</Typography>
                <TextField
                  label={institutional ? 'ח.פ / ע.מ' : 'ת.ז (לחשבונית)'}
                  value={form.billing?.taxId ?? ''}
                  onChange={(e) => setBilling('taxId', e.target.value)}
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
                />
                <TextField
                  label="איש קשר"
                  value={form.billing?.contactName ?? ''}
                  onChange={(e) => setBilling('contactName', e.target.value)}
                />
                <TextField
                  label="כתובת"
                  value={form.billing?.address ?? ''}
                  onChange={(e) => setBilling('address', e.target.value)}
                />
                {institutional && (
                  <>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!form.monthlyConsolidation}
                          onChange={(e) => setField('monthlyConsolidation', e.target.checked)}
                        />
                      }
                      label="חשבונית חודשית מרוכזת"
                    />
                    <Alert severity="info" icon={<Icon name="info" size={20} />}>
                      תעודות משלוח יצטברו ללקוח לאורך החודש, ובסופו תופק חשבונית אחת מרוכזת (מודול 8).
                    </Alert>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={saving}
              startIcon={<Icon name="save" size={20} />}
            >
              {saving ? 'שומר…' : 'שמירה'}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate(isEdit && id ? `/customers/${id}` : '/customers')}
              disabled={saving}
            >
              ביטול
            </Button>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
