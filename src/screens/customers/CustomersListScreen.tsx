import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import { watchCustomers, filterCustomers } from '@/services/customersService';
import type { Customer } from '@/types/models';
import { SERVICE_CATALOG } from '@/services/serviceCatalog';
import { Icon } from '@/ui/Icon';
import { Tag } from '@/ui/Tag';
import { Phone } from '@/ui/Num';

export function CustomersListScreen() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [term, setTerm] = useState('');

  useEffect(() => watchCustomers(setCustomers), []);

  const results = useMemo(
    () => (customers ? filterCustomers(customers, term) : []),
    [customers, term],
  );

  return (
    <Stack spacing={2} className="fade-in">
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h1">לקוחות</Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Icon name="person_add" size={20} />}
          onClick={() => navigate('/customers/new')}
        >
          לקוח חדש
        </Button>
      </Box>

      <TextField
        placeholder="חיפוש לפי שם, טלפון או איש קשר…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Icon name="search" size={22} />
              </InputAdornment>
            ),
          },
        }}
      />

      {customers === null ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : results.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2">
              {term ? 'לא נמצאו לקוחות התואמים לחיפוש.' : 'אין עדיין לקוחות. הוסיפו לקוח חדש.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {results.map((c) => (
            <Card key={c.id}>
              <CardActionArea onClick={() => navigate(`/customers/${c.id}`)}>
                <CardContent
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}
                >
                  <Avatar sx={{ bgcolor: 'primary.main', width: 42, height: 42, fontWeight: 700 }}>
                    {c.name.trim().charAt(0) || '?'}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                      <Tag tone={c.type === 'institutional' ? 'purple' : 'neutral'}>
                        {c.type === 'institutional' ? 'מוסדי' : 'פרטי'}
                      </Tag>
                      {c.monthlyConsolidation && <Tag tone="teal">חיוב חודשי</Tag>}
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      <Phone value={c.phone} />
                    </Typography>
                  </Box>
                  <Icon name="chevron_left" size={22} color="var(--mui-palette-text-disabled, #a9b7b9)" />
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      {/* Service catalog reference (used by orders/rentals in later modules) */}
      <Card sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <CardContent>
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            קטלוג השירותים
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {SERVICE_CATALOG.map((s) => (
              <Box
                key={s.type}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <Icon name={s.icon} size={18} color="#0a7d88" />
                {s.label}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
