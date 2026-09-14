# DEMO MODE — DO NOT MERGE

This branch is a **scrubbed prospect sales tour**. It must **never** be merged to `main`.

It does not use a live database, live auth, live plant credentials, or paid AI APIs. All names, phones, customers, suppliers, trucks, GPS, and money figures are fictional **Demo Bio Pellets / Acme plant** sample data.

## Run locally

```bash
VITE_DEMO_MODE=true npm run dev
```

Or:

```bash
npm run demo
```

Then open the printed localhost URL.

- Email: `demo@acme-biomass.example`
- Password: any value (prefilled as `demo`)
- User: **Jordan Admin** (admin) at **Acme Biomass Demo Co.** / **Demo Bio Pellets — Acme Plant**

Missing or placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` also enables demo mode, so `npm run build` works without secrets.

## What demo mode does

- Replaces the Supabase client with an in-memory adapter (`src/lib/demo/`) seeded with sample JSON-like rows.
- Bypasses real Auth: only the demo email is accepted; password is not checked.
- Shows a persistent banner on every screen: **DEMO — sample data only**.
- Uses a **fictional geofence** (`0.0123, 0.0456`) for attendance. Device GPS is mocked. Home weather is skipped so those coords are never sent to Open-Meteo.
- Insights answers are keyword-matched over the in-memory seed. Gemini / `ai-query` / `plant-chat` are not called.
- Stubs OCR / voice / invite / push / sheets with “not available in demo”.
- Tally / accounting export is not available (finance is payments + cost overview UI only).

## Suggested tour order

Insights → Dispatch → Shifts / Attendance → Stock / Spare Parts → Purchases → Assets → Finance → Admin.

## Clickable vs stubbed

| Area | Status |
|---|---|
| Login (`demo@acme-biomass.example`) | Clickable |
| Home dashboard | Clickable (sample stats; weather off) |
| Shifts `/shift/new`, `/shift/edit/:id`, report list/view | Clickable; child rows persist in memory via `replace_shift_report_children` |
| Purchases + suppliers `/purchase*` | Clickable (OCR stubbed) |
| Dispatch + customers + transporters `/dispatch*` | Clickable (OCR stubbed) |
| Stock + transfers `/stock`, `/stock/transfer` | Clickable |
| Tasks `/tasks` | Clickable |
| Attendance `/attendance` | Clickable; fictional geofence only |
| Spare parts `/spare-parts*` | Clickable |
| Assets `/assets*` | Clickable (sample register + events) |
| Admin `/dashboard`, settings, users/roles | Clickable; demo users only; invite/password stubbed |
| Finance `/finance` | Clickable overview/costs; no live Tally |
| Insights `/insights` | Clickable sample-data answers; no Gemini |
| Receipt OCR, voice entry | Stubbed |
| User invite / password / delete-user | Stubbed |
| Push notifications, Sheets sync | Stubbed |
| Photo upload | Stubbed (no real storage) |

Reload resets in-memory edits to the seed.

## Kept out of the prospect tour

- Live plant GPS capture / save (fictional geofence is read-only)
- Push notifications / VAPID
- Role-matrix edits
- Delete-request approve/reject
- Inviting real emails, password reset, delete-user
- Storage uploads (placeholder URLs only)
- Tally voucher post / live accounting
- Gemini / live edge analytics

## Build

```bash
VITE_DEMO_MODE=true npm run build
```

## Safety

- Branch name is `demo/scrubbed-prospect`.
- Open a **draft** PR only. Title must start with `[DEMO ONLY — DO NOT MERGE]`.
- Do not point this branch at a live Supabase project. Do not paste real plant PII or real GPS into the seed.
- Do not enable paid Google Gemini keys for the tour.
