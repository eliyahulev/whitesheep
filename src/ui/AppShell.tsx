import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/auth/AuthContext';
import { SheepMark } from './SheepMark';
import { Icon } from './Icon';
import { Tag } from './Tag';
import type { Role } from '@/types/models';

interface NavEntry {
  to: string;
  label: string;
  icon: string; // Material Symbols name
  role?: Role;
}

// Small for Module 0; later modules add orders/customers/inventory/etc.
const NAV: NavEntry[] = [
  { to: '/', label: 'בית', icon: 'home' },
  { to: '/orders', label: 'הזמנות', icon: 'receipt_long' },
  { to: '/customers', label: 'לקוחות', icon: 'group' },
  { to: '/inventory', label: 'השכרות ומלאי', icon: 'inventory_2' },
  { to: '/debtors', label: 'חייבים', icon: 'account_balance_wallet', role: 'manager' },
  { to: '/monthly-invoicing', label: 'חיוב חודשי', icon: 'request_quote', role: 'manager' },
  { to: '/users', label: 'משתמשים', icon: 'manage_accounts', role: 'manager' },
  { to: '/settings', label: 'הגדרות', icon: 'settings', role: 'manager' },
  { to: '/audit', label: 'יומן פעולות', icon: 'history', role: 'manager' },
];

const SIDEBAR_W = 248;

function Brand({ size = 26 }: { size?: number }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <SheepMark size={size} />
      <Typography sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>
        כבשה לבנה
      </Typography>
    </Box>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const items = NAV.filter((n) => !n.role || n.role === user?.role);
  const roleLabel = user?.role === 'manager' ? 'מנהל' : 'עובד';
  // Match nested routes to their section (e.g. /customers/123 → /customers).
  const current =
    items
      .filter((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? '/';

  const header = (
    <AppBar position="sticky">
      <Toolbar sx={{ gap: 1.5, minHeight: 58 }}>
        {!isDesktop && <Brand />}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {user?.displayName || user?.email}
        </Typography>
        <Tag tone={user?.role === 'manager' ? 'teal' : 'neutral'}>{roleLabel}</Tag>
        <Button
          size="small"
          color="primary"
          startIcon={<Icon name="logout" size={18} />}
          onClick={() => void signOut()}
          sx={{ minHeight: 36, paddingInline: 1.5 }}
        >
          יציאה
        </Button>
      </Toolbar>
    </AppBar>
  );

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Desktop: permanent sidebar (inline-start → RIGHT in RTL) */}
      {isDesktop && (
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_W,
            flexShrink: 0,
            height: '100dvh',
            position: 'sticky',
            top: 0,
            bgcolor: 'background.paper',
            borderInlineStart: '1px solid',
            borderColor: 'divider',
            p: 1.5,
          }}
        >
          <Box sx={{ px: 1.5, py: 2 }}>
            <Brand />
          </Box>
          <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {items.map((n) => {
              const active = n.to === current;
              return (
                <ListItemButton
                  key={n.to}
                  selected={active}
                  onClick={() => navigate(n.to)}
                  sx={{
                    borderRadius: 2.5,
                    '&.Mui-selected': { bgcolor: '#e4f1f2' },
                    '&.Mui-selected:hover': { bgcolor: '#daebec' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: active ? 'primary.main' : 'text.secondary' }}>
                    <Icon name={n.icon} fill={active} size={24} />
                  </ListItemIcon>
                  <ListItemText
                    primary={n.label}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: active ? 700 : 600,
                          color: active ? 'primary.main' : 'text.primary',
                          fontSize: 14.5,
                        },
                      },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {header}
        <Box
          component="main"
          className="fade-in"
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: 1080,
            mx: 'auto',
            p: 2,
            pb: { xs: 11, md: 3 },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Mobile: bottom navigation */}
      {!isDesktop && (
        <BottomNavigation
          value={current}
          onChange={(_, v) => navigate(v)}
          showLabels
          sx={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: 20,
            height: 66,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {items.map((n) => (
            <BottomNavigationAction
              key={n.to}
              value={n.to}
              label={n.label}
              icon={<Icon name={n.icon} fill={n.to === current} size={24} />}
              sx={{ '& .MuiBottomNavigationAction-label': { fontSize: 11, fontWeight: 600 } }}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
