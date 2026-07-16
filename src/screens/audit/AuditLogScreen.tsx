import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { watchAuditLog } from '@/services/auditService';
import type { AuditActionType, AuditLogEntry } from '@/types/models';
import { Icon } from '@/ui/Icon';
import { Tag, type TagTone } from '@/ui/Tag';
import { DateTimeText } from '@/ui/Num';
import { toDate } from '@/utils/format';

const ACTION_META: Record<AuditActionType, { label: string; tone: TagTone; icon: string }> = {
  order: { label: 'הזמנה', tone: 'teal', icon: 'receipt_long' },
  inventory: { label: 'מלאי', tone: 'purple', icon: 'inventory_2' },
  financial: { label: 'כספים', tone: 'amber', icon: 'payments' },
  customer: { label: 'לקוח', tone: 'neutral', icon: 'group' },
  system: { label: 'מערכת', tone: 'neutral', icon: 'bolt' },
  auth: { label: 'התחברות', tone: 'neutral', icon: 'login' },
};

// Filter to the three headline categories the spec calls out, plus catch-alls.
const ACTION_FILTERS: { value: AuditActionType | 'all'; label: string }[] = [
  { value: 'all', label: 'כל הפעולות' },
  { value: 'order', label: 'הזמנות' },
  { value: 'inventory', label: 'מלאי' },
  { value: 'financial', label: 'כספים' },
  { value: 'customer', label: 'לקוחות' },
  { value: 'system', label: 'מערכת' },
];

export function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [action, setAction] = useState<AuditActionType | 'all'>('all');
  const [userName, setUserName] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => watchAuditLog(setEntries), []);

  const users = useMemo(() => {
    const set = new Set((entries ?? []).map((e) => e.userName).filter(Boolean));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    return entries.filter((e) => {
      if (action !== 'all' && e.actionType !== action) return false;
      if (userName !== 'all' && e.userName !== userName) return false;
      const t = toDate(e.createdAt)?.getTime() ?? 0;
      return t >= fromTs && t <= toTs;
    });
  }, [entries, action, userName, from, to]);

  const hasFilters = action !== 'all' || userName !== 'all' || !!from || !!to;

  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">מודול 7 · יומן ביקורת</Typography>
        <Typography variant="h1">יומן פעולות</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          מי עשה מה, ומתי. תצוגה בלבד.
        </Typography>
      </Box>

      {/* Filters */}
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              alignItems: 'end',
            }}
          >
            <TextField
              select
              label="סוג פעולה"
              value={action}
              onChange={(e) => setAction(e.target.value as AuditActionType | 'all')}
            >
              {ACTION_FILTERS.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="משתמש" value={userName} onChange={(e) => setUserName(e.target.value)}>
              <MenuItem value="all">כל המשתמשים</MenuItem>
              {users.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="מתאריך"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
            />
            <TextField
              label="עד תאריך"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
            />
          </Box>
          {hasFilters && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption">
                {filtered.length} תוצאות
              </Typography>
              <Button
                size="small"
                color="primary"
                onClick={() => {
                  setAction('all');
                  setUserName('all');
                  setFrom('');
                  setTo('');
                }}
              >
                נקה סינון
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {entries === null ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2">
              {hasFilters ? 'אין רשומות התואמות לסינון.' : 'אין עדיין רשומות ביומן.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1}>
          {filtered.map((e) => {
            const meta = ACTION_META[e.actionType] ?? ACTION_META.system;
            const when = toDate(e.createdAt);
            return (
              <Card key={e.id}>
                <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1.5 }}>
                  <Icon name={meta.icon} size={22} color="#0a7d88" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{e.description}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Tag tone={meta.tone}>{meta.label}</Tag>
                      <Typography variant="caption">
                        {e.userName}
                        {when ? ' · ' : ''}
                        {when && <DateTimeText date={when} />}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
