# Kanoz Daily Report App — Build Log

**Last updated:** 2 March 2026
**App URL:** https://kanoz-daily-report.vercel.app
**GitHub:** https://github.com/raaghavk/kanoz-daily-report
**Supabase Project:** coguzmhpfmjkxmuasuoj (Mumbai region)
**Vercel Team:** team_M04R2H73Uoxt346bVNAlLdQR
**Vercel Project:** prj_3ib2S2IRzQrW7EzCAV9J34ctX8BM

---

## What This App Does

Mobile-first PWA for Kanoz Bio Energy factory supervisors to submit daily shift reports. Replaces paper forms and Google Sheets. Covers 3 plants: Prayagraj, Siswa, Gopalganj.

**Tech Stack:** React + Vite, Supabase (PostgreSQL + Auth + RLS), Vercel (auto-deploy from GitHub main branch). Inline styles throughout (no Tailwind).

---

## App Structure

### Pages & Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/pages/Home.jsx` | Dashboard with today's stats, quick actions |
| `/login` | `src/pages/Login.jsx` | Email/password login |
| `/shift/new` | `src/pages/shift/ShiftWizard.jsx` | 9-step shift report wizard |
| `/dispatch` | `src/pages/dispatch/DispatchForm.jsx` | Quick vehicle dispatch entry |
| `/purchase/new` | `src/pages/purchase/PurchaseForm.jsx` | Raw material purchase entry |
| `/purchases` | `src/pages/purchase/PurchaseList.jsx` | Purchase history |
| `/reports` | `src/pages/ReportList.jsx` | Past shift reports |
| `/reports/:id` | `src/pages/ReportView.jsx` | View single report |
| `/suppliers` | `src/pages/suppliers/SupplierList.jsx` | Supplier directory |
| `/suppliers/:id` | `src/pages/suppliers/SupplierDetail.jsx` | Supplier detail |

### 9-Step Shift Report Wizard

| Step | File | What it captures |
|------|------|-----------------|
| 1 | `Step1Header.jsx` | Date, shift (A/B), start/end time, weather |
| 2 | `Step2Machines.jsx` | Machine timings, breakdown minutes, production hours |
| 3 | `Step3Production.jsx` | Production entries: machine, pellet type, quantity, ingredients |
| 4 | `Step4RawMaterial.jsx` | Raw material usage (opening, purchased, used, closing) |
| 5 | `Step5Diesel.jsx` | Equipment diesel usage + overall diesel stock |
| 6 | `Step6Dispatch.jsx` | Read-only dispatch summary for the day |
| 7 | `Step7PelletStock.jsx` | Pellet stock: opening, production (auto from Step 3), dispatch, wastage, closing |
| 8 | `Step8Issues.jsx` | Issues with type, severity, description, photo |
| 9 | `Step9Submit.jsx` | Review & submit with handover notes |

### Shared Components

| File | Purpose |
|------|---------|
| `src/components/BottomNav.jsx` | Bottom navigation bar |
| `src/components/Layout.jsx` | App layout wrapper |
| `src/components/Modal.jsx` | Reusable modal dialog |
| `src/components/PageHeader.jsx` | Page header with back button |
| `src/components/PhotoUpload.jsx` | Camera/file upload component |
| `src/components/Stepper.jsx` | Step indicator for wizard |
| `src/components/Toast.jsx` | Toast notification system |

### Core Files

| File | Purpose |
|------|---------|
| `src/context/AuthContext.jsx` | Auth state: user, employee, plant (from employees→plants join) |
| `src/lib/supabase.js` | Supabase client init |
| `src/App.jsx` | Router setup |
| `src/main.jsx` | Entry point |

---

## Supabase Schema

### Core Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `organizations` | id, name | Top-level org (Kanoz Bio Energy) |
| `plants` | id, org_id, name | 3 plants: Prayagraj, Siswa, Gopalganj |
| `employees` | id, org_id, plant_id, auth_user_id, name, role | Links Supabase auth to plant |

### Reference Data Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `machines` | id, plant_id, name, is_active, sort_order | Per-plant machine list |
| `raw_material_types` | id, plant_id, name, is_active | Per-plant RM types |
| `pellet_types` | id, plant_id, name, is_active | Per-plant pellet types |
| `equipment` | id, plant_id, name, is_active, sort_order | Per-plant diesel equipment (Generator, Tractor, Loader, JCB) |
| `customers` | id, **org_id** (NOT plant_id), name, is_active | Shared across org |
| `suppliers` | id, org_id, name, phone, address | Supplier directory |

### Transaction Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `shift_reports` | id, plant_id, date, shift, start_time, end_time, pellet_production_mt, supervisor_id, handover_notes, remarks | Main report record |
| `machine_production` | id, shift_report_id, machine_id, hours_run, production_mt | Per-machine output |
| `raw_material_usage` | id, shift_report_id, raw_material_type_id, quantity_kg | Only stores `used` quantity |
| `equipment_diesel_log` | id, shift_report_id, equipment_name, opening_litres, added_litres, closing_litres, hours_worked | Per-equipment diesel |
| `pellet_stock` | id, shift_report_id, pellet_type_id, opening_mt, production_mt, dispatch_mt, wastage_mt, **closing_mt** (GENERATED) | closing = open + prod - disp - waste |
| `vehicle_dispatches` | id, shift_report_id, **plant_id**, **date**, truck_number, customer_id, driver_name, **invoice_no**, **katta_parchi_url**, created_by | Has own plant_id & date columns |
| `dispatch_pellets` | id, dispatch_id, pellet_type_id, **pellet_type_name**, quantity_mt | Per-pellet dispatch detail |
| `rm_purchases` | id, plant_id, supplier_id, raw_material_type_id, quantity_kg, rate_per_kg, total_amount | RM purchase entries |
| `issues` | id, shift_report_id, issue_type, description, severity, photo_url | Shift issues |

### Critical Schema Notes (gotchas)

1. **`customers` uses `org_id`**, not `plant_id` — customers are shared across all plants in the org
2. **`vehicle_dispatches` has its own `plant_id` and `date`** — don't need to join through shift_reports
3. **`pellet_stock.closing_mt` is a GENERATED column** — never insert a value for it
4. **`dispatch_pellets` has `pellet_type_name`** text column alongside `pellet_type_id`
5. **`vehicle_dispatches` column names:** `invoice_no` (not invoice_number), `katta_parchi_url` (not katta_parchi_photo)
6. **`equipment_diesel_log` uses `equipment_name`** (text, not FK) — matches equipment table by name

---

## Key Data Flows

### Shift Report Save (ShiftWizard.jsx → saveReport())

When user hits Submit on Step 9, data is saved in this order:

1. **shift_reports** — upsert main report record
2. **machine_production** — delete old + insert new (filtered: production_hours > 0)
3. **raw_material_usage** — delete old + insert new (filtered: used > 0)
4. **equipment_diesel_log** — delete old + insert new (filtered: used > 0 OR hours > 0)
5. **pellet_stock** — delete old + insert new (all pellet types)
6. **issues** — delete old + insert new

### Opening Stock Carry-Forward

When a new shift report is started (ShiftWizard loadPlantData):

1. Fetches the most recent shift_report for the same plant (ordered by date desc, shift desc)
2. Fetches that report's `pellet_stock` rows → uses `closing_mt` as new `opening_mt`
3. Fetches that report's `equipment_diesel_log` rows → uses `closing_litres` as new `opening` for matching equipment by name

### Step 7 Auto-Population

`Step7PelletStock.jsx` has a useEffect watching `data.production` (from Step 3):
- Sums production quantities by pellet_type name
- Auto-fills the Production column
- Recalculates Closing = Opening + Production - Dispatch - Wastage

### Dispatch Form Save (DispatchForm.jsx)

1. Requires an active shift_report for today
2. Inserts into `vehicle_dispatches` with plant_id, date, created_by
3. Inserts pellet entries into `dispatch_pellets` with pellet_type_name

---

## Auth Flow

1. User logs in with email/password via Supabase Auth
2. `AuthContext.jsx` fetches employee record via `employees.auth_user_id`
3. Employee includes `plants(*)` join, so `plant` object has all plant fields including `org_id`
4. All queries filter by `plant.id` or `plant.org_id` as appropriate
5. RLS policies on all tables restrict access by organization

---

## Deployment

- **Git push to `main`** triggers Vercel auto-deploy
- Build command: `npm run build` (Vite)
- Output: `dist/` folder
- No environment variables needed in Vercel (Supabase URL/key are in code — they're public anon keys)
- GitHub PAT is stored in the git remote URL for push access

---

## Bug Fix History

### Session 1-3: Initial Build
- Set up Supabase schema, imported data from CSVs
- Built React app scaffold matching v4 HTML prototype
- Deployed to Vercel

### Session 4: Critical Bug Fixes (commit df64c37)
1. **saveReport() was incomplete** — only saved shift_reports, machine_production, and issues. Added saves for raw_material_usage, equipment_diesel_log, pellet_stock
2. **Step 7 production not auto-populating** — added useEffect to sum Step 3 production by pellet type
3. **DispatchForm broken queries** — fixed fetchTodayDispatches (used direct plant_id/date instead of broken join), fetchCustomers (org_id not plant_id), column name mismatches (invoice_no, katta_parchi_url), missing fields on insert (plant_id, date, created_by)

### Session 5: Equipment & Carry-Forward (commit 8ee3b95)
1. **Created `equipment` table** in Supabase with per-plant equipment list (was hardcoded)
2. **Step 5 Diesel** now loads equipment dynamically from Supabase
3. **Opening stock carry-forward** — pellet stock and diesel opening values auto-populate from previous shift's closing values
4. **Home.jsx dispatch query fixed** — was using broken join syntax, changed to direct plant_id/date filter

---

## Known Remaining Issues / Future Work

1. **Raw material opening stock** — not carried forward (raw_material_usage only stores `quantity_kg`, not opening/closing). Would need schema changes to persist raw material opening/closing per shift.
2. **Diesel stock (overall tank)** — opening/closing not persisted in any table. `diesel_stock` only lives in client state. Would need a new table to carry forward.
3. **Bundle size** — ~595KB, could benefit from code splitting with dynamic imports
4. **No offline support** — PWA manifest exists but no service worker for offline data entry
5. **No edit/delete for submitted reports** — once submitted, reports can't be modified
6. **Photo upload** — PhotoUpload component exists but Supabase storage bucket setup needs verification
7. **Production entries save** — Step 3 production entries (with ingredients) are used for calculation but individual production line items aren't saved to their own table (they're aggregated into machine_production)
8. **Shift B date handling** — Night shift (18:00-06:00) crosses midnight; shift_start_date and shift_end_date handle this but UI doesn't auto-set end_date to next day

---

## Plant IDs (for reference)

| Plant | UUID |
|-------|------|
| Prayagraj | b0000000-0000-0000-0000-000000000001 |
| Siswa | b0000000-0000-0000-0000-000000000002 |
| Gopalganj | b0000000-0000-0000-0000-000000000003 |
