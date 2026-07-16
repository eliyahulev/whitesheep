// User-management logic (Admin SDK). Roles live in Firebase Auth custom claims
// (clients cannot set claims), and a `users/{email}` Firestore doc mirrors each
// account/invite for the manager's User Management screen.
//
// Access model: NO ONE gets into the app unless they were added first. A Google
// sign-in with no matching invite (and not an ADMIN_EMAILS bootstrap admin) is
// assigned role 'none' and denied by the app — see assignRoleOnCreate in index.ts.
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type AppRole = 'employee' | 'manager';
export type AppUserStatus = 'pending' | 'active' | 'unknown';

export interface AppUserRow {
  email: string;
  role: AppRole | null; // null → signed in but not authorized (role 'none')
  status: AppUserStatus; // pending = invited, not signed in; active = has account+role
  uid: string | null;
  displayName: string | null;
  lastSignInAt: number | null; // epoch ms
}

/** Normalize an email for use as a Firestore doc id and for comparisons. */
export function emailKey(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

function toRole(v: unknown): AppRole | null {
  return v === 'manager' || v === 'employee' ? v : null;
}

/**
 * Merge Firestore invites/profiles with real Firebase Auth accounts into one list.
 * Auth is the source of truth for who can actually sign in; Firestore carries
 * pending invites (no account yet) and display metadata.
 */
export async function listAppUsers(db: Firestore): Promise<AppUserRow[]> {
  const auth = getAuth();
  const byEmail = new Map<string, AppUserRow>();

  const snap = await db.collection('users').get();
  snap.forEach((d) => {
    const u = d.data() as Record<string, unknown>;
    const email = ((u.email as string) ?? d.id) || d.id;
    byEmail.set(emailKey(email), {
      email,
      role: toRole(u.role),
      status: (u.status as AppUserStatus) ?? 'pending',
      uid: (u.uid as string) ?? null,
      displayName: (u.displayName as string) ?? null,
      lastSignInAt:
        typeof (u.lastSignInAt as { toMillis?: () => number })?.toMillis === 'function'
          ? (u.lastSignInAt as { toMillis: () => number }).toMillis()
          : null,
    });
  });

  let pageToken: string | undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const rec of res.users) {
      const email = rec.email ?? '';
      if (!email) continue;
      const key = emailKey(email);
      const existing = byEmail.get(key);
      const claimRole = toRole((rec.customClaims as { role?: unknown } | undefined)?.role);
      const role = claimRole ?? existing?.role ?? null;
      byEmail.set(key, {
        email,
        role,
        status: role ? 'active' : 'unknown',
        uid: rec.uid,
        displayName: rec.displayName ?? existing?.displayName ?? null,
        lastSignInAt: rec.metadata.lastSignInTime
          ? Date.parse(rec.metadata.lastSignInTime)
          : (existing?.lastSignInAt ?? null),
      });
    }
    pageToken = res.pageToken;
  } while (pageToken);

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/** Count of accounts/invites that currently hold the manager role. */
export async function managerEmails(db: Firestore): Promise<string[]> {
  const users = await listAppUsers(db);
  return users.filter((u) => u.role === 'manager').map((u) => emailKey(u.email));
}

/** True when removing/demoting this email would leave the system with no manager. */
export async function isLastManager(db: Firestore, email: string): Promise<boolean> {
  const managers = await managerEmails(db);
  return managers.length <= 1 && managers.includes(emailKey(email));
}

/**
 * Invite (or authorize) an email with a role. If an Auth account already exists
 * for it, the role claim is applied immediately (and tokens revoked so the next
 * refresh picks it up); otherwise a pending invite doc is stored and consumed on
 * that user's first sign-in (assignRoleOnCreate).
 */
export async function inviteUser(
  db: Firestore,
  email: string,
  role: AppRole,
  invitedBy: string,
): Promise<{ status: 'active' | 'pending' }> {
  const auth = getAuth();
  const key = emailKey(email);
  let uid: string | null = null;
  let displayName: string | null = null;
  try {
    const rec = await auth.getUserByEmail(key);
    uid = rec.uid;
    displayName = rec.displayName ?? null;
    await auth.setCustomUserClaims(uid, { role });
    await auth.revokeRefreshTokens(uid);
  } catch {
    // No account yet — this stays a pending invite.
  }

  const ref = db.collection('users').doc(key);
  const existing = await ref.get();
  await ref.set(
    {
      email: key,
      role,
      status: uid ? 'active' : 'pending',
      uid,
      displayName,
      invitedBy,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { status: uid ? 'active' : 'pending' };
}

/** Change an existing user's/invite's role. Applies to the Auth claim if signed up. */
export async function setUserRole(db: Firestore, email: string, role: AppRole): Promise<void> {
  const auth = getAuth();
  const key = emailKey(email);
  let uid: string | null = null;
  try {
    const rec = await auth.getUserByEmail(key);
    uid = rec.uid;
    await auth.setCustomUserClaims(uid, { role });
    await auth.revokeRefreshTokens(uid);
  } catch {
    // Pending invite — only the Firestore doc changes.
  }
  await db.collection('users').doc(key).set(
    {
      email: key,
      role,
      ...(uid ? { uid, status: 'active' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Fully remove a user: delete the Auth account (if any) and the Firestore doc. */
export async function removeUser(db: Firestore, email: string): Promise<void> {
  const auth = getAuth();
  const key = emailKey(email);
  try {
    const rec = await auth.getUserByEmail(key);
    await auth.deleteUser(rec.uid);
  } catch {
    // No account (pending invite or already gone) — just drop the doc.
  }
  await db.collection('users').doc(key).delete();
}
