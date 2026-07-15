import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

// KPI tile — big teal tabular number over a caption. Used on the dashboard (Module 9).
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: 26, fontWeight: 800, color: 'primary.main' }}>
        {value}
      </Typography>
    </Card>
  );
}
