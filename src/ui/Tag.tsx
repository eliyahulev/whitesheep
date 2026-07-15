import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

// Status pill built on MUI Chip, tinted with the brand's semantic tones.
// Reused across modules for order status, customer type, payment state, inventory, etc.
export type TagTone =
  | 'neutral'
  | 'teal'
  | 'teal-solid'
  | 'amber'
  | 'success'
  | 'danger'
  | 'purple';

const TONE: Record<TagTone, { bg: string; color: string; border?: string }> = {
  neutral: { bg: '#eef2f3', color: '#33474a' },
  teal: { bg: '#e4f1f2', color: '#0a7d88' },
  'teal-solid': { bg: '#0a7d88', color: '#ffffff' },
  amber: { bg: '#fef3e0', color: '#b8730a' },
  success: { bg: '#e7f6ec', color: '#157f3b' },
  danger: { bg: '#fdecec', color: '#c11b1b', border: '#f3b9b9' },
  purple: { bg: '#f3effb', color: '#7c5bc7' },
};

export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <Chip
      label={children}
      size="small"
      sx={{
        bgcolor: t.bg,
        color: t.color,
        border: t.border ? `1px solid ${t.border}` : 'none',
        '& .MuiChip-label': { fontWeight: 700, fontSize: '11.5px' },
      }}
    />
  );
}

// Small count badge (nav counts, alert totals).
export function Badge({ count, urgent }: { count: number; urgent?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        minWidth: 20,
        height: 20,
        px: 0.75,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: '#fff',
        bgcolor: urgent ? 'error.main' : 'primary.main',
      }}
    >
      {count}
    </Box>
  );
}
