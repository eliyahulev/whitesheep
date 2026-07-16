import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/firebase/config';
import type { Role } from '@/types/models';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Email of an authenticated-but-unauthorized account we just signed out (access-denied). */
  deniedEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Map a Firebase user to an app user via its role custom claim. Access is
 * invite-only: only an explicit 'employee' or 'manager' claim grants access.
 * Anything else (including the 'none' claim assigned to un-invited sign-ins)
 * returns null → the account is denied.
 */
async function toAuthUser(fbUser: User): Promise<AuthUser | null> {
  const token = await fbUser.getIdTokenResult(true);
  const claimRole = token.claims.role;
  if (claimRole !== 'manager' && claimRole !== 'employee') return null;
  const role: Role = claimRole;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const appUser = await toAuthUser(fbUser);
      if (!appUser) {
        // Signed in with a real account but not authorized — deny and sign out.
        setDeniedEmail(fbUser.email);
        await fbSignOut(auth);
        setUser(null);
        setLoading(false);
        return;
      }
      setDeniedEmail(null);
      setUser(appUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      deniedEmail,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle() {
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        // New users get their role claim from assignRoleOnCreate (async). Poll briefly
        // so the first session already reflects the assigned role — including 'none'
        // for un-invited accounts, which we then deny.
        let appUser: AuthUser | null = null;
        for (let i = 0; i < 8; i++) {
          const token = await cred.user.getIdTokenResult(true);
          const claimRole = token.claims.role;
          if (claimRole === 'manager' || claimRole === 'employee') {
            appUser = await toAuthUser(cred.user);
            break;
          }
          if (claimRole) break; // role assigned but not authorized (e.g. 'none') → stop waiting
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!appUser) {
          setDeniedEmail(cred.user.email);
          await fbSignOut(auth);
          const err = new Error('not-authorized') as Error & { code?: string };
          err.code = 'app/not-authorized';
          throw err;
        }
        setDeniedEmail(null);
        setUser(appUser);
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, loading, deniedEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
