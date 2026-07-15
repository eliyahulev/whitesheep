import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';
import type { Role } from '@/types/models';

// Role-based route guard. Enforces auth in the UI (Firestore rules enforce it on data).
export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: Role; // if set, requires exactly this role (manager-only screens)
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
