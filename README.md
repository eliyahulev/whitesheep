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

## Deploy (production)

The frontend deploys to **Vercel**; Firestore rules, Cloud Functions and scheduled jobs deploy to
**Firebase**. Cloud Functions require the Firebase **Blaze** (pay-as-you-go) plan.

### 1. Firebase project
1. Create a Firebase project; enable **Firestore** and **Email/Password Auth**; upgrade to **Blaze**.
2. Set `default` in `.firebaserc` to your project id.
3. Deploy rules + functions (this also creates the Cloud Scheduler jobs for the scheduled functions):
   ```bash
   firebase deploy --only firestore:rules,functions
   ```
   Scheduled jobs: `debtEngine` and `rentalOverdueSweep` (every 6h) — visible under Cloud Scheduler.

### 2. Functions environment (secrets — server-side only)
Set in `functions/.env` (or as deployed env/secrets). Absent → the provider runs in **simulated** mode.
| Var | Purpose |
| --- | --- |
| `MESSAGING_PROVIDER` | `twilio` (SMS/WhatsApp) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | Twilio credentials |
| `MORNING_ENV` | `sandbox` or `production` |
| `MORNING_API_ID` / `MORNING_API_SECRET` | Morning (Green Invoice) API key |

### 3. Frontend on Vercel
1. Import the repo in Vercel (framework **Vite** — `vercel.json` sets build + SPA rewrite).
2. Set the project **Environment Variables** (from Firebase console → project settings → web app):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
   and **`VITE_USE_EMULATOR=false`**.
3. Deploy (`vercel --prod` or via Git integration).

### 4. Roles (custom claims)
Roles (`employee` / `manager`) are Firebase Auth **custom claims**, enforced in the UI and in
Firestore rules. Set them on real users with the Admin SDK, e.g. adapt `scripts/seed.ts`
(`auth.setCustomUserClaims(uid, { role: 'manager' })`) to run against production.

## Scripts
- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm run lint` — TypeScript no-emit check
- `npm run emulators` — builds functions, then starts Auth + Firestore + **Functions** emulators
- `npm run functions:build` — compile Cloud Functions (`functions/`)
- `npm run seed` — seed demo users, settings, customers, orders, inventory & rentals into the emulators

## Environment variables
- **Frontend** (`.env.example`): the standard Firebase web config keys + `VITE_USE_EMULATOR`.
- **Functions** (`functions/.env.example`): messaging (Twilio) + invoicing (Morning) credentials —
  server-side only. Without them, those integrations run in simulated mode. See the Deploy section.

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
