# מכבסה — Laundry & Inventory Management

Mobile-first, 100% Hebrew (RTL) web app for managing a laundry business: customers, orders, rental inventory, payments, debts, and an admin panel.

**Stack:** Vite + React + TypeScript (frontend) · Firebase (Firestore, Auth, Cloud Functions) · deploy to Vercel.

> Built module-by-module. See `CLAUDE.md` for the global context and build progress.

## Prerequisites
- Node 20+ and npm
- Firebase CLI (`npm i -g firebase-tools`) — for the local emulator suite
- Java 11+ (required by the Firestore emulator)

## Local development (with emulators — no real Firebase project needed)

```bash
npm install

# Terminal 1 — start Auth + Firestore emulators
npm run emulators

# Terminal 2 — seed demo users + settings into the emulator
npm run seed

# Terminal 3 — run the app (uses .env.local → VITE_USE_EMULATOR=true)
npm run dev
```

Open the app, then log in with a demo account:

| Role  | Email                | Password  |
| ----- | -------------------- | --------- |
| מנהל  | manager@demo.test    | demo1234  |
| עובד  | employee@demo.test   | demo1234  |

The Emulator UI is at http://127.0.0.1:4000.

## Connecting to a real Firebase project
1. Create a Firebase project; enable Firestore + Email/Password Auth.
2. Copy `.env.example` → `.env` (or set Vercel env vars) and fill in the web app config.
3. Set `VITE_USE_EMULATOR=false`.
4. Deploy rules: `firebase deploy --only firestore:rules`.
5. Set role custom claims on real users (adapt `scripts/seed.ts` to run against production, or use the Admin SDK / a Cloud Function — added in Module 10).

## Scripts
- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm run lint` — TypeScript no-emit check
- `npm run emulators` — Firebase Auth + Firestore emulators
- `npm run seed` — seed demo users + settings into the emulators

## Environment variables
See `.env.example`. All are the standard Firebase web config keys plus `VITE_USE_EMULATOR`.

## Project structure
```
src/
  auth/         AuthContext + role route guard (custom-claim roles)
  firebase/     Firebase init, emulator wiring, collection refs
  screens/      Route screens
  services/     settings service, logAction, integration interfaces (SMS/invoicing)
  types/        Firestore collection TypeScript types
  ui/           App shell (mobile bottom-nav / desktop right sidebar), Bidi helper
  utils/        Israeli formatting + validation (phone, currency, dates)
scripts/seed.ts Demo data seeder
firestore.rules Role-based security rules
```

## Roles
- **employee** — orders, weighing, item logging, inventory reserve/return, operational messages.
- **manager** — all of the above + audit log, debtors, settings, invoicing, reports.

Roles are Firebase Auth custom claims, enforced in both the UI (route guard) and Firestore Security Rules.
