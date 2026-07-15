# CLAUDE.md — Global Context

PROJECT: Web app for managing a laundry business — customers, orders, and rental inventory, with an admin panel.

TECH STACK (do not deviate):
- Frontend: Vite + React + TypeScript. UI is 100% Hebrew, right-to-left (RTL). Clean, responsive, fast for daily staff use.
- Backend/data: Firebase — Firestore (DB), Firebase Auth (login + roles via custom claims), Cloud Functions (server logic + integrations), scheduled Cloud Functions / Cloud Scheduler (time-based jobs).
- Hosting: frontend deploys to Vercel; functions run on Firebase.

CONVENTIONS:
- Nothing hard-coded. Prices, the "X time" for payment-link expiry, reminder intervals, and all message texts live in a Firestore `settings` doc and are editable in a Settings screen.
- All external integrations (SMS, invoicing) go behind a service interface so the provider can be swapped. Build the interface first; real providers later.
- Every material action calls a shared logAction(user, actionType, description) helper that writes to the `auditLog` collection.
- Two roles: `employee` and `manager` (Firebase Auth custom claims). Enforce with Firestore Security Rules AND in the UI.
- Customer-facing message templates are in HEBREW and must be used verbatim (provided per module).
- Seed demo data for every collection so flows are testable. Handle external API failures gracefully and log them.

HEBREW + RTL (NON-NEGOTIABLE — applies to every module):
- The app is 100% Hebrew and right-to-left. Set dir="rtl" and lang="he" at the app root; every screen, modal, table, form, toast, and email/PDF is RTL by default.
- Load a Hebrew webfont (Heebo / Assistant / Rubik). No Latin-only fonts for UI text.
- Use CSS logical properties (margin-inline, padding-inline, inset-inline, text-align: start/end) — NOT hard-coded left/right — so layout mirrors correctly.
- Mirror all directional UI: navigation sits on the RIGHT, back/forward and progress/timeline flow right-to-left, chevrons and directional icons are flipped.
- Numbers, prices, and weights display LTR inside RTL text (use bidi isolation, e.g. <bdi>) so "150 ש\"ח" and "12.5 ק\"ג" never break. Currency shown as ₪ / ש"ח; dates as dd/MM/yyyy; times 24h.
- Israeli input formats: validate Israeli phone numbers (05x-xxxxxxx) and format them consistently; allow Hebrew names.
- All customer-facing SMS/WhatsApp templates are Hebrew, verbatim as given per module, with correct RTL rendering of injected fields.
- Generated invoices/receipts must render Hebrew RTL correctly.
- Test with real Hebrew content (not lorem ipsum).

ROLES:
- employee: create/update orders, weigh laundry, log items, reserve & return inventory, send operational messages.
- manager: everything above + audit log, debtors list, settings, invoicing, reports.

WORKING STYLE: Build one module at a time. After each module, summarize what changed, list any new env vars/config, and stop. Do not build features from later modules early.

## Design system — "כבשה לבנה / White Sheep" (apply to every module)
Brand: **כבשה לבנה** (White Sheep). Mobile-first, calm all-day operational tool.
- Palette (CSS vars in `src/styles.css`): `--paper #f4f6f2` (cool wool), `--ink #1e2a28`,
  `--accent #17756b` (fresh eucalyptus), `--wool #e9e3d6`, `--sun #e4a93c`, `--danger #b8442d`.
- Type: `--font-display` Frank Ruhl Libre (headings/brand, restrained) · `--font-ui` Assistant
  (UI) · `--font-mono` IBM Plex Mono for ALL numeric data (prices, weights, ids, phones) —
  wrap numbers in `<Bidi>` + `className="num"`.
- Signature component: the **laundry tag** — `<Tag tone="wool|accent|sun|danger|success">`
  (punched-paper chip). Use for statuses, customer types, inventory categories everywhere.
- Brand mark: `<SheepMark />`. Eyebrow labels: `.eyebrow`. Section headers: `.section-h`.
- Layout: bottom-nav on mobile, right sidebar ≥900px (nav sits on the RIGHT in RTL).
- Always use logical properties (never left/right). Reuse `.card`, `.btn`, `.stack`, `.tag`.

## Local emulator note
The Firebase **emulator suite requires Java** (Google ships it as a Java app) — install via
`brew install openjdk`, then run emulators with `PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`.
Java is NOT an app/production dependency — only for local emulators. Production = JS on Vercel
+ Firebase cloud. Emulator ports: Auth 9099, Firestore 8080, UI 4000.

## Build progress
- [x] Module 0 — Foundation & Scaffolding ✓ verified end-to-end (both roles, rules, logAction)
- [ ] Module 1 — Customers & Service Types
- [ ] Module 2 — Orders & Order Lifecycle
- [ ] Module 3 — Messaging Integration
- [ ] Module 4 — Payments, Checkout Link & Invoice
- [ ] Module 5 — Debt Engine
- [ ] Module 6 — Rental & Inventory + Overdue Alerts
- [ ] Module 7 — Audit Log Viewer
- [ ] Module 8 — Institutional Monthly Invoicing
- [ ] Module 9 — Manager Dashboard
- [ ] Module 10 — Hardening & Deploy

## Project layout
- `src/` — React app (Vite)
- `src/firebase/` — Firebase init + emulator wiring
- `src/types/` — Firestore collection TypeScript types
- `src/services/` — settings service, logAction, integration interfaces
- `src/auth/` — auth context + role guard
- `src/screens/` — route screens
- `functions/` — Firebase Cloud Functions (added in later modules)
- `scripts/seed.ts` — demo data seeder (targets emulator)
- `firestore.rules` — security rules

## Local dev
- `npm run dev` — Vite dev server
- `npm run emulators` — Firebase Auth + Firestore emulators
- `npm run seed` — seed demo data + demo users into emulators
- Set `VITE_USE_EMULATOR=true` in `.env.local` to point the app at emulators.
