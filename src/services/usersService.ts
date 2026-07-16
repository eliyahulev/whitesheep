import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import type { AppUser, Role } from '@/types/models';

// User management goes through manager-only Cloud Functions — custom claims can't
// be set from the client. Each callable also writes its own audit entry server-side.

/** List all users (Auth accounts + pending invites). */
export async function fetchUsers(): Promise<AppUser[]> {
  const fn = httpsCallable<Record<string, never>, { users: AppUser[] }>(functions, 'listUsers');
  const res = await fn({});
  return res.data.users;
}

/** Invite / authorize an email with a role (applied immediately if account exists). */
export async function inviteUser(
  email: string,
  role: Role,
): Promise<{ status: 'active' | 'pending' }> {
  const fn = httpsCallable<{ email: string; role: Role }, { status: 'active' | 'pending' }>(
    functions,
    'inviteUser',
  );
  const res = await fn({ email, role });
  return res.data;
}

/** Change a user's role. */
export async function setUserRole(email: string, role: Role): Promise<void> {
  const fn = httpsCallable<{ email: string; role: Role }, { ok: boolean }>(functions, 'setUserRole');
  await fn({ email, role });
}

/** Remove a user entirely (delete account + invite). */
export async function removeUser(email: string): Promise<void> {
  const fn = httpsCallable<{ email: string }, { ok: boolean }>(functions, 'removeUser');
  await fn({ email });
}
