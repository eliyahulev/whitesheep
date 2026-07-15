import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

// Placeholder — the full searchable audit log viewer is Module 7.
export function AuditPlaceholderScreen() {
  return (
    <Stack spacing={2} className="fade-in">
      <Box>
        <Typography variant="overline">מודול 7</Typography>
        <Typography variant="h1">יומן פעולות</Typography>
      </Box>
      <Card>
        <CardContent>
          <Typography variant="body2">
            מסך צפייה מלא ביומן הביקורת (חיפוש וסינון) ייבנה במודול 7. כרגע פעולות נרשמות ברקע
            באמצעות <code>logAction</code>.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
