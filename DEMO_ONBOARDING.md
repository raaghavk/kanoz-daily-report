# Demo Bio Pellets — Prospect Onboarding Guide

Sales walkthrough for the scrubbed **Demo Bio Pellets** tour. All names, phones, trucks, GPS, and money figures are **fictional sample data**. This branch must **never** be merged to `main`.

## Login

| | |
|---|---|
| Email | `demo@shree-biopellets.example` |
| Password | any value (prefilled as `demo`) |
| User | **Rohan Sharma** (admin) |

Orange banner on every screen: **DEMO — sample data only**.

## Org / plant (fiction)

- **Org:** Shree Demo Bio Pellets Pvt Ltd
- **Plant:** Riverside Demo Plant — Gorakhpur

Indian locale only: +91 mobiles, ₹, UP-style vehicle numbers (e.g. `UP53 AB 1234`). Attendance uses a **fake geofence** (`0.0123, 0.0456`) — not a real plant GPS.

## Links

- Draft PR (do not merge): https://github.com/raaghavk/kanoz-daily-report/pull/53
- Preview today is SSO-gated. A **public Vercel URL will replace the SSO preview** in a later step — do not change production Deployment Protection for this tour.

## 60-second pitch path

Stay on this order. Click create + list on each module so the prospect sees writes stick until reload.

1. **Login** — Rohan Sharma at Shree Demo Bio Pellets.
2. **Home** — sample shift stats, orange DEMO banner, no Kanoz branding.
3. **Shifts** — open a report or `/shift/new`; mix Used stays in kg.
4. **Purchases** — suppliers + RM slips (OCR is stubbed).
5. **Dispatch** — customers / transporters / trucks.
6. **Stock** — plot balances and transfers.
7. **Tasks** — assign and see it in the list.
8. **Spares / assets** — catalogue, stock-in, asset register + events.
9. **Attendance** — check-in on the **fake geofence** (device GPS is mocked).
10. **Finance** — payments + cost overview only — **no Tally**.
11. **Admin** — full dashboard on a **laptop**. On a phone you get **Desktop only — open on desktop for full admin**.

Reload resets in-memory edits back to the seed.

## Stubbed (do not demo as live)

- Storage uploads (placeholder URLs only)
- Push notifications
- Gemini / live Insights AI
- Voice entry
- Live Tally voucher post
- Real user invites / password reset / delete-user

## Sales do / don’t

**Do**

- Treat every number as fictional tour data.
- Say the banner out loud: sample data only.
- Use a laptop for Admin; phone for the operator tour (home → shifts → attendance).
- Run locally with `VITE_DEMO_MODE` when the preview is gated.

**Don’t**

- Never merge this branch to `main`.
- Never point the demo at production Supabase `coguzmhpfmjkxmuasuoj`.
- Never paste real plant PII, phones, GPS, or live credentials into the seed.
- Don’t enable paid Gemini keys or WhatsApp for this tour.

## Local run (`VITE_DEMO_MODE`)

```bash
VITE_DEMO_MODE=true npm run dev
```

Or `npm run demo`. Open the printed localhost URL and sign in as above.

Missing or placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` also turns demo mode on, so the app runs with **zero secrets**.

See `DEMO.md` for the full clickable-vs-stubbed matrix.
