# DEMO MODE — DO NOT MERGE

This branch is a **scrubbed prospect sales tour**. It must **never** be merged to `main`.

It does not use a live database, live auth, live plant credentials, or paid AI APIs. All names, phones, customers, suppliers, and trucks are fictional.

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
- User: **Jordan Admin** (admin) at **Acme Biomass Demo Co.** / **Demo Pellet Plant — Riverside**

Missing or placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` also enables demo mode, so `npm run build` works without secrets.

## What demo mode does

- Replaces the Supabase client with an in-memory adapter (`src/lib/demo/`) seeded with sample JSON-like rows.
- Bypasses real Auth: only the demo email is accepted; password is not checked.
- Shows a persistent banner on every screen: **DEMO — sample data only**.
- Stubs Gemini / OCR / voice / invite / push / sheets edge functions with “not available in demo”.

## Clickable vs stubbed

| Area | Status |
|---|---|
| Login (demo user) | Clickable |
| Home dashboard | Clickable (sample stats) |
| Shift reports list + detail | Clickable |
| Dispatch list + detail | Clickable |
| Purchases list + detail (payment flags) | Clickable |
| Spare parts home, catalogue, part detail | Clickable |
| Tasks | Clickable |
| Stock & recipes, attendance, directories | Clickable from seed (best-effort) |
| New shift / dispatch / purchase save | In-memory only; reset on reload |
| AI assistant, receipt OCR, voice entry | Stubbed |
| User invite / password / delete-user | Stubbed |
| Push notifications, Sheets sync | Stubbed |
| Photo upload | Stubbed (no real storage) |

## Build

```bash
VITE_DEMO_MODE=true npm run build
```

## Safety

- Branch name is `demo/scrubbed-prospect`.
- Open a **draft** PR only. Title must start with `[DEMO ONLY — DO NOT MERGE]`.
- Do not point this branch at a live Supabase project. Do not paste real plant PII into the seed.
- Do not enable paid Google Gemini keys for the tour.
