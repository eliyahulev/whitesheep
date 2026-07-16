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
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function toAuthUser(fbUser: User): Promise<AuthUser> {
  // Role comes from Firebase Auth custom claims. In the emulator/seed we set
  // claim `role` to 'employee' | 'manager'. Default to employee if absent.
  const token = await fbUser.getIdTokenResult(true);
  const claimRole = token.claims.role;
  const role: Role = claimRole === 'manager' ? 'manager' : 'employee';
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser ? await toAuthUser(fbUser) : null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle() {
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        // New users get their role claim from the assignRoleOnCreate function (async).
        // Poll briefly for the claim so the first session already has the right role.
        for (let i = 0; i < 8; i++) {
          const token = await cred.user.getIdTokenResult(true);
          if (token.claims.role) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        setUser(await toAuthUser(cred.user));
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
