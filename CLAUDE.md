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

## Design system — **Material Design (MUI)**. Apply to EVERY module. Full spec: `DESIGN_SYSTEM.md`
Base = `@mui/material` v9 themed with the brand. Theme = `src/theme.ts` (source of truth);
providers in `src/main.tsx` (RTL Emotion cache → ThemeProvider → CssBaseline). Font: **Heebo**.
Icons: **Material Symbols Rounded** via `<Icon name="…" />` (index.html loads the font).
- Palette (MUI tokens): `primary` teal `#0a7d88` (brand/chrome/links), `secondary` amber
  `#ef8a46` (**primary action button** — `color="secondary"`), `error #dc2626`, `success #16a34a`,
  `warning #e08a00`, `background.default #f4f7f8`, `text.primary #1c2b2e`.
- Use MUI directly: `<Button/Card/CardContent/TextField/Typography/Stack/Box>`. Vertical =
  `<Stack spacing>`; horizontal rows = `<Box sx={{display:'flex',gap,flexWrap}}>` (v9 Stack
  rejects inline alignItems/flexWrap/useFlexGap). TextField LTR fields:
  `slotProps={{ htmlInput:{ dir:'ltr' } }}`.
- App components in `src/ui/`: `<Tag tone=neutral|teal|teal-solid|amber|success|danger|purple>`,
  `<Badge>`, `<Stat>`, `<Icon>`, `<Num>/<Money>/<Weight>/<Phone>/<DateText>`, `<Bidi>`,
  `<SheepMark>`, `<AppShell>`.
- Order-status → Tag tone: received=teal-solid, in_progress=teal, ready=amber, delivered=success,
  debt=danger. Always wrap numbers in a `<Num>`-family component. No hard-coded hex/px — theme only.
- Layout: mobile-first — MUI AppBar + BottomNavigation on mobile → right sidebar ≥md. RTL via theme.

## Local emulator note
The Firebase **emulator suite requires Java** (Google ships it as a Java app) — install via
`brew install openjdk`, then run emulators with `PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`.
Java is NOT an app/production dependency — only for local emulators. Production = JS on Vercel
+ Firebase cloud. Emulator ports: Auth 9099, Firestore 8080, UI 4000.

## Build progress
- [x] Module 0 — Foundation & Scaffolding ✓ verified end-to-end (both roles, rules, logAction)
- [x] Module 1 — Customers & Service Types ✓ CRUD + search + roles (employee no-delete, UI+rules) verified
      · `customersService.ts`, `serviceCatalog.ts`, `src/screens/customers/*`, nav "לקוחות"
- [x] Module 2 — Orders & Order Lifecycle ✓ create/weigh-after-wash/status transitions + drop-off stub verified
      · `ordersService.ts`, `messageTemplates.ts`, `src/screens/orders/*`, nav "הזמנות", order-number counter
      · Firestore init uses `ignoreUndefinedProperties: true` (see src/firebase/config.ts)
- [x] Module 3 — Messaging Integration ✓ real provider via `sendSms` Cloud Function; drop-off + both
      ready paths (self-pickup / delivery w/ cost + payment-link placeholder) + guard + logging verified
      · `functions/` (Twilio provider + simulate fallback), client routes non-stub via httpsCallable
      · settings.integrations.smsProvider='twilio'; `npm run emulators` now includes functions
- [x] Module 4 — Payments, Checkout Link & Invoice ✓ Morning payment link + settle → חשבונית מס קבלה
      (type 320) for private, payment recorded; institutional deferred to M8. Both paths verified.
      · `functions/src/morning.ts` (Green Invoice API + simulate fallback), callables
        `createOrderPaymentLink` + `settleOrderPayment`; client `paymentsService.ts`; order-detail תשלום card
      · Morning env (functions): MORNING_ENV / MORNING_API_ID / MORNING_API_SECRET (absent → simulated)
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
