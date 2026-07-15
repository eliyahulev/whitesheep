# Design System — כבשה לבנה (Material Design)

The app is built on **Material Design via MUI** (`@mui/material` v9), themed with the brand
palette from the reference design. **Every module uses this.**

- **Theme (source of truth):** `src/theme.ts` — palette, Heebo typography, shape, component
  defaults. Consume it with MUI's `sx`, `<Typography variant>`, and theme tokens
  (`primary.main`, `text.secondary`, …). Don't hard-code hex/px in components.
- **Providers:** `src/main.tsx` wires `CacheProvider` (RTL Emotion cache) → `ThemeProvider` →
  `CssBaseline`. RTL is handled by `stylis-plugin-rtl` (`src/ui/rtlCache.ts`) plus
  `direction: 'rtl'` in the theme and `dir="rtl"` on `<html>`.
- **Icons:** Material Symbols (Rounded), loaded in `index.html`. Use `<Icon name="…" />`
  (`src/ui/Icon.tsx`) with names from https://fonts.google.com/icons — e.g. `home`, `settings`,
  `history`, `logout`, `fact_check`. Pass `fill` for the filled (active) state.

## Palette (MUI theme)
| Role | Token | Value |
| --- | --- | --- |
| Brand / chrome / links | `primary.main` | `#0a7d88` (light `#0e9aa7`, dark `#096a74`) |
| **Primary action button** | `secondary.main` | `#ef8a46` (amber) |
| Danger / delete | `error` | `#dc2626` / light `#fdecec` / dark `#8e1616` |
| Success / paid | `success` | `#16a34a` / `#e7f6ec` / `#157f3b` |
| Warning / ready | `warning` | `#e08a00` / `#fef3e0` / `#b8730a` |
| App background | `background.default` | `#f4f7f8` |
| Surface | `background.paper` | `#ffffff` |
| Text | `text.primary` / `secondary` | `#1c2b2e` / `#5b6b6e` |
| Divider / borders | `divider` | `#e7edee` |

**teal = brand**, **amber (`color="secondary"`) = the primary action button.**

## Typography (Heebo)
`h1` 32/800 · `h2` 26/800 · `h3` 20/700 · `h4` 18 · `body1` 15 · `body2` 13.5 muted ·
`caption` 12.5 · `overline` teal eyebrow · `button` 14/700 (no uppercase).
Numbers → tabular via the `<Num>` family.

## Component conventions
Use MUI components directly, themed by `theme.ts`:
- **Buttons** — `<Button variant="contained" color="secondary">` = primary action (amber);
  `color="primary"` = brand/auth CTA (teal); `variant="outlined"` = secondary; `color="error"` =
  destructive. Icons via `startIcon={<Icon name="…" />}`.
- **Surfaces** — `<Card><CardContent>` (rounded 14, hairline border, soft shadow via theme).
- **Text fields** — `<TextField variant="outlined">` (default), floating labels, RTL. For LTR
  fields (email/phone) pass `slotProps={{ htmlInput: { dir: 'ltr' } }}`.
- **Layout** — `<Stack spacing>` for vertical; `<Box sx={{ display:'flex', gap, flexWrap }}>` for
  horizontal rows (MUI v9 Stack doesn't take `alignItems`/`flexWrap`/`useFlexGap` inline).

## App-specific components (`src/ui/`)
- **`<Tag tone>`** — status pill (MUI Chip + brand tint). Tones: `neutral`, `teal`, `teal-solid`,
  `amber`, `success`, `danger`, `purple`. Order-status convention: received=`teal-solid`,
  in_progress=`teal`, ready=`amber`, delivered=`success`, debt=`danger`.
- **`<Badge count urgent>`** — small count badge.
- **`<Stat label value>`** — KPI tile (dashboard, Module 9).
- **`<Num>/<Money>/<Weight>/<Phone>/<DateText>/<DateTimeText>`** — numeric data rendered LTR +
  tabular inside RTL text (wrap `<bdi>`). Always use these for numbers. **`<Bidi>`** = raw.
- **`<Icon name fill size>`** — Material Symbols. **`<SheepMark>`** — brand logo.
- **`<AppShell>`** — AppBar + right sidebar (desktop) / BottomNavigation (mobile), role-filtered.

## Rules for new module UI
1. Compose from MUI + `src/ui/`. Theme tokens only — no hard-coded hex/px.
2. Every number goes through a `<Num>`-family component.
3. New status/category → an existing `Tag` tone; don't invent colors.
4. Primary action = `<Button variant="contained" color="secondary">` (amber). Destructive = `error`.
5. Icons = `<Icon name="…" />` (Material Symbols). Mobile-first; rely on MUI breakpoints (`sx={{ …, md: … }}`) and `useMediaQuery`.

> Note: MUI adds ~250 kB gz to the bundle. Fine for an internal tool; revisit code-splitting in
> Module 10 (hardening) if needed.
