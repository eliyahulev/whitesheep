import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RouteGuard';
import { AppShell } from '@/ui/AppShell';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AuditPlaceholderScreen } from '@/screens/AuditPlaceholderScreen';
import { CustomersListScreen } from '@/screens/customers/CustomersListScreen';
import { CustomerFormScreen } from '@/screens/customers/CustomerFormScreen';
import { CustomerDetailScreen } from '@/screens/customers/CustomerDetailScreen';
import { OrdersListScreen } from '@/screens/orders/OrdersListScreen';
import { OrderCreateScreen } from '@/screens/orders/OrderCreateScreen';
import { OrderDetailScreen } from '@/screens/orders/OrderDetailScreen';
import { DebtorsScreen } from '@/screens/debtors/DebtorsScreen';
import { InventoryScreen } from '@/screens/inventory/InventoryScreen';
import { RentalCreateScreen } from '@/screens/inventory/RentalCreateScreen';

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
            <Route path="/customers" element={<CustomersListScreen />} />
            <Route path="/customers/new" element={<CustomerFormScreen />} />
            <Route path="/customers/:id" element={<CustomerDetailScreen />} />
            <Route path="/customers/:id/edit" element={<CustomerFormScreen />} />
            <Route path="/orders" element={<OrdersListScreen />} />
            <Route path="/orders/new" element={<OrderCreateScreen />} />
            <Route path="/orders/:id" element={<OrderDetailScreen />} />
            <Route path="/inventory" element={<InventoryScreen />} />
            <Route path="/rentals/new" element={<RentalCreateScreen />} />
            <Route
              path="/debtors"
              element={
                <RequireAuth role="manager">
                  <DebtorsScreen />
                </RequireAuth>
              }
            />
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
