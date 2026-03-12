# Supabase Setup Prompts

Copy-paste these prompts into Supabase AI chat to complete the setup.

---

## Prompt 1: Deploy invite-user Edge Function

> **Where to run**: Supabase Dashboard → Edge Functions → New Function

You need to manually create the edge function. Go to your Supabase Dashboard:
1. Go to **Edge Functions** in the sidebar
2. Click **Create new function**
3. Name it `invite-user`
4. Paste the code from `supabase/functions/invite-user/index.ts` in your repo

Or run this from your local machine:
```bash
npx supabase login
npx supabase link --project-ref coguzmhpfmjkxmuasuoj
npx supabase functions deploy invite-user
```

---

## Prompt 2: Enable RLS on All Tables

Paste this into **Supabase AI chat** or **SQL Editor**:

```
I need to set up Row Level Security (RLS) on all my tables. Here's my app's data model:

- `employees` table has `auth_user_id` (links to Supabase auth), `plant_id`, and `org_id`
- Users should only access data belonging to their plant (identified by matching plant_id from their employee record)
- Org-level tables (employees, plants, suppliers) should be accessible within the same org_id

Please enable RLS and create policies for ALL of these tables. The pattern should be:
- Get the current user's employee record via: `SELECT plant_id, org_id FROM employees WHERE auth_user_id = auth.uid()`
- Plant-scoped tables: allow access where table.plant_id matches user's plant_id
- Org-scoped tables: allow access where table.org_id matches user's org_id
- Child tables (linked via shift_report_id): allow access where the parent shift_report's plant_id matches

Tables needing plant-scoped RLS (SELECT, INSERT, UPDATE, DELETE for all):
- shift_reports (has plant_id)
- vehicle_dispatches (has plant_id)
- machines (has plant_id)
- raw_material_types (has plant_id)
- pellet_types (has plant_id)
- equipment (has plant_id)
- raw_material_purchases (has plant_id)
- customers (has plant_id)

Tables needing org-scoped RLS:
- employees (has org_id) — users see all employees in their org
- plants (has org_id) — users see all plants in their org
- suppliers (has org_id) — users see all suppliers in their org

Child tables needing RLS via parent shift_report_id → shift_reports.plant_id:
- machine_production (has shift_report_id)
- raw_material_usage (has shift_report_id)
- equipment_diesel_log (has shift_report_id)
- pellet_stock (has shift_report_id)
- diesel_stock (has shift_report_id)
- diesel_purchases (has shift_report_id)
- issues (has shift_report_id)

Child table via vehicle_dispatches:
- dispatch_pellets (has dispatch_id → vehicle_dispatches)

IMPORTANT: push_subscriptions already has RLS — skip it.

For each table:
1. Enable RLS: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
2. Create a policy for ALL operations (SELECT, INSERT, UPDATE, DELETE)
3. Use subqueries to get the user's plant_id/org_id from employees table
4. Also add a service_role bypass policy so edge functions still work

Generate the full SQL I can run.
```

---

## Prompt 3: Verify RLS is Working

After applying the SQL from Prompt 2, paste this into Supabase AI chat:

```
I just enabled RLS on all my tables. Can you help me verify it's working correctly?

1. List all tables that have RLS enabled
2. List all tables that do NOT have RLS enabled
3. Show me the policies on shift_reports, employees, and machine_production tables
4. Check if there are any tables without policies that should have them
```

---

## Prompt 4: Test New User Flow

After deploying the invite-user function and setting up RLS:

```
I have an edge function called invite-user that creates auth users and links them to employee records. Can you help me verify:

1. Check if the invite-user function is deployed and active
2. Show me the employees table schema to confirm it has auth_user_id column
3. Verify that the employees RLS policy allows admins to update auth_user_id on employee records
4. Make sure new auth users created by invite-user can query their own employee record via the RLS policy
```

---

## Quick Reference: What Each Policy Does

| Scope | Logic | Tables |
|-------|-------|--------|
| **Plant-scoped** | `plant_id IN (SELECT plant_id FROM employees WHERE auth_user_id = auth.uid())` | shift_reports, vehicle_dispatches, machines, raw_material_types, pellet_types, equipment, raw_material_purchases, customers |
| **Org-scoped** | `org_id IN (SELECT org_id FROM employees WHERE auth_user_id = auth.uid())` | employees, plants, suppliers |
| **Child (shift)** | `shift_report_id IN (SELECT id FROM shift_reports WHERE plant_id IN (SELECT plant_id FROM employees WHERE auth_user_id = auth.uid()))` | machine_production, raw_material_usage, equipment_diesel_log, pellet_stock, diesel_stock, diesel_purchases, issues |
| **Child (dispatch)** | `dispatch_id IN (SELECT id FROM vehicle_dispatches WHERE plant_id IN (SELECT plant_id FROM employees WHERE auth_user_id = auth.uid()))` | dispatch_pellets |
