import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RouteGuard';
import { AppShell } from '@/ui/AppShell';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AuditPlaceholderScreen } from '@/screens/AuditPlaceholderScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<HomeScreen />} />
            <Route
              path="/settings"
              element={
                <RequireAuth role="manager">
                  <SettingsScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/audit"
              element={
                <RequireAuth role="manager">
                  <AuditPlaceholderScreen />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
