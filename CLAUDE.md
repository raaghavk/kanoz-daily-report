# CLAUDE.md — Kanoz Daily Report / Manufacturing ERP

Guidance for any AI/developer working on this codebase. This project began as a
biomass-pellet plant operations app and is being built into a **general
manufacturing ERP** that can be resold to other pellet manufacturers and, on the
same foundation, adapted to other process industries (e.g. cement).

## Stack
- **Frontend:** React 19 + Vite, React Router 7, plain JS/JSX, **inline styles only**
  (no Tailwind/CSS files), lucide-react icons. TanStack React Query for fetching.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions in Deno).
- **AI:** Google Gemini (gemini-2.5-flash) via edge functions. Secret GEMINI_API_KEY.
- **Deploy:** Vercel (auto-deploy from main), with a /supabase proxy for India ISP.
- **Tests:** vitest (npm run test:run). Keep the suite green on every change.

## UI conventions
cream bg #fefae0, header greens #1b4332 / #2d6a4f, card border #e5ddd0,
muted #8a8d7a, text #2c2c2c, white cards radius 14. Mobile-first. Match existing
component patterns (src/pages/shift/Step*.jsx, AdminPanel.jsx).

## Core domain model (the reusable foundation)
A plant is the unit of operation. Everything hangs off it:

  organization -> plant(s) -> employees (roles)
  plant -> machines        (transform material: capacity/hr, motor HP, machine_type)
  plant -> equipment       (support gear: generator/vehicle/loader; fuel, rating, opening_stock_litres)
  plant -> raw_material_types (inputs + in-house intermediates; opening_stock_kg, GCV)
  plant -> pellet_types    (finished goods; grade, GCV)   <- "products" in generic terms

Assembly line = configurable process routes. A process_routes row is ONE conversion:
input material -> [ordered machines] -> output material (+ expected yield%). Outputs are
real stored materials, so routes chain and intermediates can be held in stock
(Wood Log -> [Log Eater] -> Small Log (dries) -> [Hammer Mill] -> Saw Dust). Machines are
shared across routes. This is the heart of the ERP and is industry-agnostic.

Daily capture = the 11-step shift report (ShiftWizard.jsx): header, machine hours,
raw material & mixes, in-house processing (runs against routes), production, diesel,
dispatches, pellet stock, issues, submit. Stock accounting is idempotent:
closing = opening + purchased + produced(in-house) - used(mix + processing input).

Other modules: raw-material purchases (OCR slip scan), vehicle dispatches,
suppliers/customers/transporters directories (+ transporter vehicles), spare parts,
assets (QR lifecycle), tasks, attendance, delete-request approvals, admin dashboard,
Stock & Recipes screen, AI "Ask" assistant.

## Key conventions (follow these)
- RLS: every table has enable row level security + an org_isolation policy scoping to
  get_user_org_id() (directly or via plant->org). New tables MUST add one.
- Soft delete: transactional tables use is_deleted boolean; always filter it out.
- Roles (src/lib/permissions.js): admin, plant_manager, supervisor, purchase_manager,
  accountant. UI gates on can(role, action). Server-side role RLS is still TODO.
- Dates: use getLocalDate() (src/lib/dateUtils) - never toISOString() for "today".
- Migrations: add a file in supabase/migrations/ AND apply it to the project.
- Edge functions (verify_jwt true): extract-receipt (OCR->Gemini), plant-chat
  (directory+summaries+weather), ai-query (NL analytics: Gemini writes a sandboxed
  read-only SELECT via execute_readonly_query, executes, summarizes - the "ask
  anything" engine), parse-voice-entry, invite-user/set-user-password/delete-user,
  send-push-notification, sync-to-sheets.
- Never loosen execute_readonly_query grants - service_role-only, SELECT-only with
  word-boundary keyword blocking; the AI is its only caller.

## Adapting to another industry (e.g. cement) - the principle
The model already generalizes. To retarget, DO NOT fork the logic - only terminology
and seed config change:
- pellet_types = finished products (cement grades / clinker). raw_material_types =
  inputs (limestone, clay, gypsum) + intermediates.
- machines = kilns, ball mills, crushers (via machine_type options).
- process_routes = the production line (Limestone -> [Crusher] -> Crushed -> [Kiln] ->
  Clinker -> [Mill] -> Cement). Same table, different data.
- Shift report, stock accounting, purchases, dispatch, directories, attendance, and
  the AI assistant are all domain-neutral already.
- To productize: add a per-org "terminology" config (labels for product / raw-material
  / machine) + industry seed sets, rather than hardcoding "pellet".

## Current status / open work
- DONE: configurable assembly line, GCV grading, in-house conversion + stock chaining,
  attendance, ai-query analytics, richer directories, equipment/customer fields.
- NEXT: Cost of production (power/diesel/labour -> true INR/kg per product) - data
  foundation exists; money rollup is next.
- LATER: iPad/tablet wide layout; server-side role RLS; Tally/accounting integration;
  native app-store wrapper; face-attendance for labour; terminology config for
  multi-industry.
