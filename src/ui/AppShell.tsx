import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { SheepMark } from './SheepMark';
import type { Role } from '@/types/models';

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  role?: Role; // restricts visibility (manager-only)
}

// Nav is intentionally small for Module 0. Business screens arrive in later modules.
const NAV: NavEntry[] = [
  { to: '/', label: 'בית', icon: '🏠' },
  { to: '/settings', label: 'הגדרות', icon: '⚙️', role: 'manager' },
  { to: '/audit', label: 'יומן פעולות', icon: '📋', role: 'manager' },
];

function Brand() {
  return (
    <span className="brandmark">
      <SheepMark size={26} />
      כבשה לבנה
    </span>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const items = NAV.filter((n) => !n.role || n.role === user?.role);
  const roleLabel = user?.role === 'manager' ? 'מנהל' : 'עובד';

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="ניווט ראשי">
        <div className="nav-brand">
          <Brand />
        </div>
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="ico" aria-hidden>
              {n.icon}
            </span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="content-col">
        <header className="app-header">
          <span className="nav-brand-mobile">
            <Brand />
          </span>
          <span className="spacer" />
          <span className="user-chip">
            <span>{user?.displayName || user?.email}</span>
            <span className={`tag ${user?.role === 'manager' ? 'accent' : 'wool'}`}>{roleLabel}</span>
          </span>
          <button className="linkbtn" onClick={() => void signOut()}>
            יציאה
          </button>
        </header>

        <main className="app-main fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
