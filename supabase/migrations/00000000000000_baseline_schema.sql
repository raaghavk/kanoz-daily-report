-- ============================================================
-- BASELINE SCHEMA — Kanoz Daily Report
-- Generated 2026-07-03 by introspecting the live Supabase project
-- "Kanoz Daily Report v2" (coguzmhpfmjkxmuasuoj).
-- Includes all security/performance fixes applied 2026-07-02.
--
-- Purpose: disaster-recovery / new-environment reference.
-- Commit to supabase/migrations/ so the schema lives in git.
-- (Storage bucket "photos" and Auth settings are configured in
-- the dashboard and are not part of this file.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== TABLES ====================

CREATE TABLE public.app_config (
  key text NOT NULL,
  value text NOT NULL
);

CREATE TABLE public.organizations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.plants (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  state text,
  is_active boolean DEFAULT true,
  financial_year_start date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid,
  name text NOT NULL,
  mobile text,
  role text DEFAULT 'worker'::text NOT NULL,
  is_active boolean DEFAULT true,
  auth_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text
);

CREATE TABLE public.machines (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  plant_id uuid NOT NULL,
  name text NOT NULL,
  machine_type text,
  capacity_mt_per_hour numeric(10,2),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.equipment (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plant_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pellet_types (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  plant_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_material_types (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  plant_id uuid NOT NULL,
  name text NOT NULL,
  unit text DEFAULT 'kg'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  mobile text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  mobile text,
  raw_material_type text,
  rate_offered numeric(10,2),
  sample_gcv numeric(10,2),
  sample_photo_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  address text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  registered_by text,
  remarks text,
  plant_id uuid
);

CREATE TABLE public.transporters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.vehicles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plant_id uuid NOT NULL,
  number text NOT NULL,
  type text DEFAULT 'company'::text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.shift_reports (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  plant_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  shift text NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  pellet_production_mt numeric(10,3) DEFAULT 0,
  start_power_reading numeric(15,5) DEFAULT 0,
  end_power_reading numeric(15,5) DEFAULT 0,
  power_consumed_kwh numeric(15,5) DEFAULT (end_power_reading - start_power_reading),
  supervisor_id uuid,
  remarks text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  shift_start_date date,
  shift_end_date date,
  handover_notes text,
  status text DEFAULT 'submitted'::text,
  is_deleted boolean DEFAULT false
);

CREATE TABLE public.machine_production (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid NOT NULL,
  machine_id uuid NOT NULL,
  hours_run numeric(10,3) DEFAULT 0,
  production_mt numeric(10,3) DEFAULT 0,
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  pellet_type_name text,
  from_time text,
  to_time text,
  breakdown_hours numeric DEFAULT 0,
  total_hours numeric DEFAULT 0,
  did_not_run boolean DEFAULT false NOT NULL
);

CREATE TABLE public.raw_material_usage (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid NOT NULL,
  raw_material_type_id uuid NOT NULL,
  quantity_kg numeric(12,2) DEFAULT 0,
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  opening_kg numeric DEFAULT 0,
  closing_kg numeric DEFAULT 0,
  purchased_kg numeric DEFAULT 0
);

CREATE TABLE public.pellet_stock (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid NOT NULL,
  pellet_type_id uuid,
  opening_mt numeric(10,3) DEFAULT 0,
  production_mt numeric(10,3) DEFAULT 0,
  dispatch_mt numeric(10,3) DEFAULT 0,
  wastage_mt numeric(10,3) DEFAULT 0,
  closing_mt numeric(10,3) DEFAULT (((opening_mt + production_mt) - dispatch_mt) - wastage_mt),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.diesel_stock (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shift_report_id uuid NOT NULL,
  opening_litres numeric DEFAULT 0,
  purchased_litres numeric DEFAULT 0,
  purchase_cost numeric DEFAULT 0,
  closing_litres numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  used_litres numeric DEFAULT 0
);

CREATE TABLE public.diesel_purchases (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid,
  litres numeric DEFAULT 0 NOT NULL,
  cost_per_litre numeric DEFAULT 0 NOT NULL,
  total_cost numeric DEFAULT (litres * cost_per_litre),
  receipt_url text,
  created_at timestamp with time zone DEFAULT now(),
  purchase_time time without time zone
);

CREATE TABLE public.equipment_diesel_log (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid NOT NULL,
  equipment_name text NOT NULL,
  opening_litres numeric(10,2) DEFAULT 0,
  added_litres numeric(10,2) DEFAULT 0,
  closing_litres numeric(10,2) DEFAULT 0,
  hours_worked numeric(10,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  used_litres numeric DEFAULT 0
);

CREATE TABLE public.issues (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid NOT NULL,
  machine_id uuid,
  issue_type text,
  description text NOT NULL,
  severity text DEFAULT 'medium'::text,
  is_resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  photo_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.shift_mixes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shift_report_id uuid,
  plant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  name text DEFAULT 'Mix'::text NOT NULL,
  type text DEFAULT 'Sample'::text NOT NULL,
  opening_kg numeric DEFAULT 0,
  prepared_kg numeric DEFAULT 0,
  used_kg numeric DEFAULT 0,
  closing_kg numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.shift_mix_compositions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  mix_id uuid,
  raw_material_type_id uuid,
  raw_material_name text,
  quantity_kg numeric DEFAULT 0
);

CREATE TABLE public.shift_mix_machine_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  mix_id uuid,
  shift_report_id uuid,
  machine_id uuid,
  quantity_kg numeric DEFAULT 0
);

CREATE TABLE public.raw_material_purchases (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  plant_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  serial_no text,
  supplier_id uuid,
  supplier_name text,
  vehicle_number text,
  tractor_owner text,
  raw_material_type text NOT NULL,
  quantity_kg numeric(12,2) DEFAULT 0 NOT NULL,
  rate_per_kg numeric(10,2) DEFAULT 0,
  loading_expense numeric(10,2) DEFAULT 0,
  transport_expense numeric(10,2) DEFAULT 0,
  other_expense numeric(10,2) DEFAULT 0,
  katta_parchi_url text,
  remarks text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  payment_status text DEFAULT 'Pending'::text,
  moisture_percent numeric(5,2) DEFAULT 0,
  unloading_expense numeric(10,2) DEFAULT 0,
  raw_material_type_id uuid,
  employee_id uuid,
  net_weight numeric(12,2),
  deduction_kg numeric(12,2),
  is_deleted boolean DEFAULT false,
  purchase_time time without time zone,
  total_rm_amount numeric DEFAULT (quantity_kg * rate_per_kg),
  total_amount numeric DEFAULT (((((quantity_kg * rate_per_kg) + loading_expense) + unloading_expense) + transport_expense) + other_expense),
  avg_cost_per_kg numeric DEFAULT
CASE
    WHEN (quantity_kg > (0)::numeric) THEN ((((((quantity_kg * rate_per_kg) + loading_expense) + unloading_expense) + transport_expense) + other_expense) / quantity_kg)
    ELSE (0)::numeric
END
);

CREATE TABLE public.vehicle_dispatches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  shift_report_id uuid,
  plant_id uuid NOT NULL,
  truck_number text NOT NULL,
  customer_id uuid,
  destination text,
  transporter text,
  driver_name text,
  driver_phone text,
  invoice_no text,
  katta_parchi_url text,
  loading_time time without time zone,
  dispatch_time time without time zone,
  remarks text,
  date date DEFAULT CURRENT_DATE NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  loading_date date,
  dispatch_date date,
  transporter_id uuid,
  is_deleted boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.dispatch_pellets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  dispatch_id uuid NOT NULL,
  pellet_type_id uuid,
  pellet_type_name text,
  quantity_mt numeric(10,3) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.spare_parts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  part_number text,
  category text,
  unit text DEFAULT 'pcs'::text NOT NULL,
  min_stock_level numeric,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  brand text
);

CREATE TABLE public.spare_parts_plant_config (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  part_id uuid NOT NULL,
  min_stock_level numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.spare_parts_purchases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  part_id uuid NOT NULL,
  supplier_id uuid,
  quantity numeric NOT NULL,
  rate_per_unit numeric,
  total_amount numeric DEFAULT (quantity * COALESCE(rate_per_unit, (0)::numeric)),
  purchase_date date DEFAULT CURRENT_DATE NOT NULL,
  bill_number text,
  bill_image_url text,
  warranty_months integer,
  warranty_expiry_date date,
  purchased_by text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  gst_percent numeric DEFAULT 0,
  gst_amount numeric DEFAULT round((((quantity * COALESCE(rate_per_unit, (0)::numeric)) * COALESCE(gst_percent, (0)::numeric)) / (100)::numeric), 2),
  grand_total numeric DEFAULT round(((quantity * COALESCE(rate_per_unit, (0)::numeric)) + (((quantity * COALESCE(rate_per_unit, (0)::numeric)) * COALESCE(gst_percent, (0)::numeric)) / (100)::numeric)), 2),
  plant_id uuid
);

CREATE TABLE public.spare_parts_reorder_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  part_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  requested_by text,
  requested_at timestamp with time zone DEFAULT now(),
  ordered_by text,
  ordered_at timestamp with time zone,
  expected_delivery_date date,
  supplier_name text,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.spare_parts_suppliers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  alternate_phone text,
  email text,
  address text,
  gst_number text,
  category text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  is_repair_shop boolean DEFAULT false NOT NULL
);

CREATE TABLE public.spare_parts_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  part_id uuid NOT NULL,
  quantity numeric NOT NULL,
  usage_date date DEFAULT CURRENT_DATE NOT NULL,
  machine_name text,
  purpose text,
  issued_to text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  plant_id uuid
);

CREATE TABLE public.assets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  code text NOT NULL,
  asset_type text NOT NULL,
  name text NOT NULL,
  make text,
  rating text,
  serial_no text,
  new_price numeric,
  warranty_until date,
  warranty_doc_url text,
  status text DEFAULT 'in_store'::text NOT NULL,
  current_location text,
  current_machine_id uuid,
  photo_url text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE TABLE public.asset_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  asset_id uuid NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid,
  event_type text NOT NULL,
  event_date date DEFAULT CURRENT_DATE NOT NULL,
  machine_id uuid,
  to_location text,
  from_location text,
  supplier_id uuid,
  work_type text,
  cost numeric,
  recovered_value numeric,
  expected_return date,
  photo_url text,
  note text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  title text NOT NULL,
  due_date date,
  assigned_to_employee_id uuid,
  assigned_by_employee_id uuid,
  status text DEFAULT 'open'::text NOT NULL,
  completion_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  done_at timestamp with time zone,
  closed_at timestamp with time zone
);

CREATE TABLE public.delete_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  org_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  performed_by uuid,
  performed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  event_type text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ==================== CONSTRAINTS ====================

ALTER TABLE public.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE public.plants ADD CONSTRAINT plants_pkey PRIMARY KEY (id);
ALTER TABLE public.plants ADD CONSTRAINT plants_org_id_code_key UNIQUE (org_id, code);
ALTER TABLE public.plants ADD CONSTRAINT plants_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE public.employees ADD CONSTRAINT employees_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT employees_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.machines ADD CONSTRAINT machines_pkey PRIMARY KEY (id);
ALTER TABLE public.machines ADD CONSTRAINT machines_plant_id_name_key UNIQUE (plant_id, name);
ALTER TABLE public.machines ADD CONSTRAINT machines_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);
ALTER TABLE public.equipment ADD CONSTRAINT equipment_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.pellet_types ADD CONSTRAINT pellet_types_pkey PRIMARY KEY (id);
ALTER TABLE public.pellet_types ADD CONSTRAINT pellet_types_plant_id_name_key UNIQUE (plant_id, name);
ALTER TABLE public.pellet_types ADD CONSTRAINT pellet_types_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.raw_material_types ADD CONSTRAINT raw_material_types_pkey PRIMARY KEY (id);
ALTER TABLE public.raw_material_types ADD CONSTRAINT raw_material_types_plant_id_name_key UNIQUE (plant_id, name);
ALTER TABLE public.raw_material_types ADD CONSTRAINT raw_material_types_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
ALTER TABLE public.customers ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.transporters ADD CONSTRAINT transporters_pkey PRIMARY KEY (id);
ALTER TABLE public.transporters ADD CONSTRAINT transporters_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_type_check CHECK ((type = ANY (ARRAY['company'::text, 'other'::text])));
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_plant_id_date_shift_key UNIQUE (plant_id, date, shift);
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_shift_check CHECK ((shift = ANY (ARRAY['A'::text, 'B'::text])));
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id);
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES employees(id);
ALTER TABLE public.machine_production ADD CONSTRAINT machine_production_pkey PRIMARY KEY (id);
ALTER TABLE public.machine_production ADD CONSTRAINT machine_production_shift_report_id_machine_id_key UNIQUE (shift_report_id, machine_id);
ALTER TABLE public.machine_production ADD CONSTRAINT machine_production_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machines(id);
ALTER TABLE public.machine_production ADD CONSTRAINT machine_production_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.raw_material_usage ADD CONSTRAINT raw_material_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.raw_material_usage ADD CONSTRAINT raw_material_usage_raw_material_type_id_fkey FOREIGN KEY (raw_material_type_id) REFERENCES raw_material_types(id);
ALTER TABLE public.raw_material_usage ADD CONSTRAINT raw_material_usage_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.pellet_stock ADD CONSTRAINT pellet_stock_pkey PRIMARY KEY (id);
ALTER TABLE public.pellet_stock ADD CONSTRAINT pellet_stock_pellet_type_id_fkey FOREIGN KEY (pellet_type_id) REFERENCES pellet_types(id);
ALTER TABLE public.pellet_stock ADD CONSTRAINT pellet_stock_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.diesel_stock ADD CONSTRAINT diesel_stock_pkey PRIMARY KEY (id);
ALTER TABLE public.diesel_stock ADD CONSTRAINT diesel_stock_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.diesel_purchases ADD CONSTRAINT diesel_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.diesel_purchases ADD CONSTRAINT diesel_purchases_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.equipment_diesel_log ADD CONSTRAINT equipment_diesel_log_pkey PRIMARY KEY (id);
ALTER TABLE public.equipment_diesel_log ADD CONSTRAINT equipment_diesel_log_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD CONSTRAINT issues_pkey PRIMARY KEY (id);
ALTER TABLE public.issues ADD CONSTRAINT issues_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE public.issues ADD CONSTRAINT issues_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machines(id);
ALTER TABLE public.issues ADD CONSTRAINT issues_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.shift_mixes ADD CONSTRAINT shift_mixes_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_mixes ADD CONSTRAINT shift_mixes_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.shift_mix_compositions ADD CONSTRAINT shift_mix_compositions_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_mix_compositions ADD CONSTRAINT shift_mix_compositions_mix_id_fkey FOREIGN KEY (mix_id) REFERENCES shift_mixes(id) ON DELETE CASCADE;
ALTER TABLE public.shift_mix_machine_usage ADD CONSTRAINT shift_mix_machine_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_mix_machine_usage ADD CONSTRAINT shift_mix_machine_usage_mix_id_fkey FOREIGN KEY (mix_id) REFERENCES shift_mixes(id) ON DELETE CASCADE;
ALTER TABLE public.shift_mix_machine_usage ADD CONSTRAINT shift_mix_machine_usage_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_tractor_owner_check CHECK ((tractor_owner = ANY (ARRAY['Company Owned'::text, 'Other owner'::text])));
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id);
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_raw_material_type_id_fkey FOREIGN KEY (raw_material_type_id) REFERENCES raw_material_types(id);
ALTER TABLE public.raw_material_purchases ADD CONSTRAINT raw_material_purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_pkey PRIMARY KEY (id);
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id);
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_shift_report_id_fkey FOREIGN KEY (shift_report_id) REFERENCES shift_reports(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_dispatches ADD CONSTRAINT vehicle_dispatches_transporter_id_fkey FOREIGN KEY (transporter_id) REFERENCES transporters(id);
ALTER TABLE public.dispatch_pellets ADD CONSTRAINT dispatch_pellets_pkey PRIMARY KEY (id);
ALTER TABLE public.dispatch_pellets ADD CONSTRAINT dispatch_pellets_dispatch_id_fkey FOREIGN KEY (dispatch_id) REFERENCES vehicle_dispatches(id) ON DELETE CASCADE;
ALTER TABLE public.dispatch_pellets ADD CONSTRAINT dispatch_pellets_pellet_type_id_fkey FOREIGN KEY (pellet_type_id) REFERENCES pellet_types(id);
ALTER TABLE public.spare_parts ADD CONSTRAINT spare_parts_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts ADD CONSTRAINT spare_parts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_plant_config ADD CONSTRAINT spare_parts_plant_config_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts_plant_config ADD CONSTRAINT spare_parts_plant_config_plant_id_part_id_key UNIQUE (plant_id, part_id);
ALTER TABLE public.spare_parts_plant_config ADD CONSTRAINT spare_parts_plant_config_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_plant_config ADD CONSTRAINT spare_parts_plant_config_part_id_fkey FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_plant_config ADD CONSTRAINT spare_parts_plant_config_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_purchases ADD CONSTRAINT spare_parts_purchases_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts_purchases ADD CONSTRAINT spare_parts_purchases_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_purchases ADD CONSTRAINT spare_parts_purchases_part_id_fkey FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE RESTRICT;
ALTER TABLE public.spare_parts_purchases ADD CONSTRAINT spare_parts_purchases_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.spare_parts_purchases ADD CONSTRAINT spare_parts_purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES spare_parts_suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.spare_parts_reorder_requests ADD CONSTRAINT spare_parts_reorder_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts_reorder_requests ADD CONSTRAINT spare_parts_reorder_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ordered'::text, 'received'::text])));
ALTER TABLE public.spare_parts_reorder_requests ADD CONSTRAINT spare_parts_reorder_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_reorder_requests ADD CONSTRAINT spare_parts_reorder_requests_part_id_fkey FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_reorder_requests ADD CONSTRAINT spare_parts_reorder_requests_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_suppliers ADD CONSTRAINT spare_parts_suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts_suppliers ADD CONSTRAINT spare_parts_suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_usage ADD CONSTRAINT spare_parts_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.spare_parts_usage ADD CONSTRAINT spare_parts_usage_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.spare_parts_usage ADD CONSTRAINT spare_parts_usage_part_id_fkey FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE RESTRICT;
ALTER TABLE public.spare_parts_usage ADD CONSTRAINT spare_parts_usage_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE public.assets ADD CONSTRAINT assets_org_id_code_key UNIQUE (org_id, code);
ALTER TABLE public.assets ADD CONSTRAINT assets_current_machine_id_fkey FOREIGN KEY (current_machine_id) REFERENCES machines(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.assets ADD CONSTRAINT assets_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_pkey PRIMARY KEY (id);
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machines(id);
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id);
ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES spare_parts_suppliers(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'closed'::text])));
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_by_employee_id_fkey FOREIGN KEY (assigned_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_employee_id_fkey FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_entity_type_check CHECK ((entity_type = ANY (ARRAY['purchase'::text, 'dispatch'::text, 'shift_report'::text])));
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES employees(id);
ALTER TABLE public.delete_requests ADD CONSTRAINT delete_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES employees(id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])));
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES employees(id);
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_employee_id_event_type_key UNIQUE (employee_id, event_type);
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_employee_id_key UNIQUE (employee_id);
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- ==================== INDEXES ====================

CREATE INDEX idx_asset_events_asset ON public.asset_events USING btree (asset_id, event_date);
CREATE INDEX idx_asset_events_machine_id ON public.asset_events USING btree (machine_id);
CREATE INDEX idx_asset_events_org_id ON public.asset_events USING btree (org_id);
CREATE INDEX idx_asset_events_plant_id ON public.asset_events USING btree (plant_id);
CREATE INDEX idx_asset_events_supplier_id ON public.asset_events USING btree (supplier_id);
CREATE INDEX idx_assets_code ON public.assets USING btree (org_id, code);
CREATE INDEX idx_assets_current_machine_id ON public.assets USING btree (current_machine_id);
CREATE INDEX idx_assets_plant_status ON public.assets USING btree (plant_id, status);
CREATE INDEX idx_audit_log_performed_by ON public.audit_log USING btree (performed_by);
CREATE INDEX idx_audit_log_table_record ON public.audit_log USING btree (table_name, record_id);
CREATE INDEX idx_customers_org ON public.customers USING btree (org_id);
CREATE INDEX idx_delete_requests_org ON public.delete_requests USING btree (org_id);
CREATE INDEX idx_delete_requests_requested_by ON public.delete_requests USING btree (requested_by);
CREATE INDEX idx_delete_requests_reviewed_by ON public.delete_requests USING btree (reviewed_by);
CREATE INDEX idx_delete_requests_status ON public.delete_requests USING btree (status);
CREATE INDEX idx_diesel_purchases_shift_report_id ON public.diesel_purchases USING btree (shift_report_id);
CREATE INDEX idx_diesel_stock_shift_report_id ON public.diesel_stock USING btree (shift_report_id);
CREATE INDEX idx_dispatch_pellets_dispatch ON public.dispatch_pellets USING btree (dispatch_id);
CREATE INDEX idx_dispatch_pellets_pellet_type_id ON public.dispatch_pellets USING btree (pellet_type_id);
CREATE INDEX idx_employees_org ON public.employees USING btree (org_id);
CREATE INDEX idx_employees_plant ON public.employees USING btree (plant_id);
CREATE INDEX idx_equipment_plant ON public.equipment USING btree (plant_id);
CREATE INDEX idx_equipment_diesel_report ON public.equipment_diesel_log USING btree (shift_report_id);
CREATE INDEX idx_issues_machine_id ON public.issues USING btree (machine_id);
CREATE INDEX idx_issues_report ON public.issues USING btree (shift_report_id);
CREATE INDEX idx_machine_production_machine_id ON public.machine_production USING btree (machine_id);
CREATE INDEX idx_machine_production_report ON public.machine_production USING btree (shift_report_id);
CREATE INDEX idx_machines_plant ON public.machines USING btree (plant_id);
CREATE INDEX idx_pellet_stock_pellet_type_id ON public.pellet_stock USING btree (pellet_type_id);
CREATE INDEX idx_pellet_stock_report ON public.pellet_stock USING btree (shift_report_id);
CREATE INDEX idx_pellet_types_plant ON public.pellet_types USING btree (plant_id);
CREATE INDEX idx_plants_org ON public.plants USING btree (org_id);
CREATE INDEX idx_push_subscriptions_employee_id ON public.push_subscriptions USING btree (employee_id);
CREATE INDEX idx_purchases_plant_date_active ON public.raw_material_purchases USING btree (plant_id, date, is_deleted);
CREATE INDEX idx_raw_material_purchases_created_by ON public.raw_material_purchases USING btree (created_by);
CREATE INDEX idx_raw_material_purchases_employee_id ON public.raw_material_purchases USING btree (employee_id);
CREATE INDEX idx_raw_material_purchases_raw_material_type_id ON public.raw_material_purchases USING btree (raw_material_type_id);
CREATE INDEX idx_rmp_plant_date ON public.raw_material_purchases USING btree (plant_id, date);
CREATE INDEX idx_rmp_supplier ON public.raw_material_purchases USING btree (supplier_id);
CREATE INDEX idx_raw_material_usage_raw_material_type_id ON public.raw_material_usage USING btree (raw_material_type_id);
CREATE INDEX idx_raw_material_usage_shift_report_id ON public.raw_material_usage USING btree (shift_report_id);
CREATE INDEX idx_shift_mix_compositions_mix_id ON public.shift_mix_compositions USING btree (mix_id);
CREATE INDEX idx_shift_mix_machine_usage_mix_id ON public.shift_mix_machine_usage USING btree (mix_id);
CREATE INDEX idx_shift_mix_machine_usage_shift_report_id ON public.shift_mix_machine_usage USING btree (shift_report_id);
CREATE INDEX idx_shift_mixes_shift_report_id ON public.shift_mixes USING btree (shift_report_id);
CREATE INDEX idx_shift_reports_created_by ON public.shift_reports USING btree (created_by);
CREATE INDEX idx_shift_reports_plant_date ON public.shift_reports USING btree (plant_id, date);
CREATE INDEX idx_shift_reports_plant_date_active ON public.shift_reports USING btree (plant_id, date, is_deleted);
CREATE INDEX idx_shift_reports_supervisor_id ON public.shift_reports USING btree (supervisor_id);
CREATE INDEX idx_spare_parts_org ON public.spare_parts USING btree (org_id);
CREATE INDEX idx_spare_parts_plant_config_org_id ON public.spare_parts_plant_config USING btree (org_id);
CREATE INDEX idx_spare_parts_plant_config_part_id ON public.spare_parts_plant_config USING btree (part_id);
CREATE INDEX idx_spare_parts_plant_config_plant_part ON public.spare_parts_plant_config USING btree (plant_id, part_id);
CREATE INDEX idx_spare_parts_purchases_org ON public.spare_parts_purchases USING btree (org_id);
CREATE INDEX idx_spare_parts_purchases_part ON public.spare_parts_purchases USING btree (part_id);
CREATE INDEX idx_spare_parts_purchases_plant ON public.spare_parts_purchases USING btree (plant_id);
CREATE INDEX idx_spare_parts_purchases_supplier_id ON public.spare_parts_purchases USING btree (supplier_id);
CREATE INDEX idx_reorder_requests_part ON public.spare_parts_reorder_requests USING btree (part_id);
CREATE INDEX idx_reorder_requests_plant ON public.spare_parts_reorder_requests USING btree (plant_id);
CREATE INDEX idx_reorder_requests_status ON public.spare_parts_reorder_requests USING btree (status);
CREATE INDEX idx_spare_parts_reorder_requests_org_id ON public.spare_parts_reorder_requests USING btree (org_id);
CREATE INDEX idx_spare_parts_suppliers_org ON public.spare_parts_suppliers USING btree (org_id);
CREATE INDEX idx_spare_parts_usage_org ON public.spare_parts_usage USING btree (org_id);
CREATE INDEX idx_spare_parts_usage_part ON public.spare_parts_usage USING btree (part_id);
CREATE INDEX idx_spare_parts_usage_plant ON public.spare_parts_usage USING btree (plant_id);
CREATE INDEX idx_suppliers_org_id ON public.suppliers USING btree (org_id);
CREATE INDEX idx_suppliers_plant ON public.suppliers USING btree (plant_id);
CREATE INDEX idx_tasks_assigned_by_employee_id ON public.tasks USING btree (assigned_by_employee_id);
CREATE INDEX idx_tasks_assigned_to_employee_id ON public.tasks USING btree (assigned_to_employee_id);
CREATE INDEX idx_tasks_org_id ON public.tasks USING btree (org_id);
CREATE INDEX idx_tasks_plant_id ON public.tasks USING btree (plant_id);
CREATE INDEX idx_transporters_org ON public.transporters USING btree (org_id);
CREATE INDEX idx_dispatches_plant_date_active ON public.vehicle_dispatches USING btree (plant_id, date, is_deleted);
CREATE INDEX idx_vehicle_dispatches_created_by ON public.vehicle_dispatches USING btree (created_by);
CREATE INDEX idx_vehicle_dispatches_customer_id ON public.vehicle_dispatches USING btree (customer_id);
CREATE INDEX idx_vehicle_dispatches_plant_date ON public.vehicle_dispatches USING btree (plant_id, date);
CREATE INDEX idx_vehicle_dispatches_report ON public.vehicle_dispatches USING btree (shift_report_id);
CREATE INDEX idx_vehicle_dispatches_transporter_id ON public.vehicle_dispatches USING btree (transporter_id);
CREATE INDEX idx_vehicles_plant_id ON public.vehicles USING btree (plant_id);

-- ==================== FUNCTIONS ====================

CREATE OR REPLACE FUNCTION public.get_user_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT e.org_id FROM employees e
    WHERE e.auth_user_id = auth.uid()
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_plant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT e.plant_id FROM employees e
    WHERE e.auth_user_id = auth.uid()
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Admin-dashboard helper. LOCKED DOWN 2026-07-02: only service_role may execute
-- (was previously executable by anon = full RLS bypass for anyone).
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result JSONB;
  upper_query TEXT;
BEGIN
  -- Safety check: only allow SELECT
  upper_query := UPPER(TRIM(query_text));
  IF NOT (upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords even within SELECT
  IF upper_query LIKE '%INSERT%' OR upper_query LIKE '%UPDATE%' OR upper_query LIKE '%DELETE%'
     OR upper_query LIKE '%DROP%' OR upper_query LIKE '%ALTER%' OR upper_query LIKE '%TRUNCATE%'
     OR upper_query LIKE '%CREATE%' OR upper_query LIKE '%GRANT%' OR upper_query LIKE '%REVOKE%' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  -- Execute and return as JSON
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
  INTO result;

  RETURN result;
END;
$function$;

-- Function permission hardening (applied 2026-07-02)
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_plant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plant_id() TO authenticated, service_role;

-- ==================== TRIGGERS ====================

CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diesel_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diesel_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_pellets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_diesel_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pellet_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pellet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_mix_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_mix_machine_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_mixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_plant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_reorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- ==================== POLICIES ====================

CREATE POLICY "Service role only" ON public.app_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY org_isolation ON public.asset_events FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.assets FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY audit_log_policy ON public.audit_log FOR ALL TO authenticated USING ((performed_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((performed_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY org_isolation ON public.customers FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY delete_requests_admin_update ON public.delete_requests FOR UPDATE TO authenticated USING (((org_id = get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM employees
  WHERE ((employees.auth_user_id = ( SELECT auth.uid() AS uid)) AND (employees.role = 'admin'::text)))))) WITH CHECK ((org_id = get_user_org_id()));
CREATE POLICY delete_requests_insert ON public.delete_requests FOR INSERT TO authenticated WITH CHECK ((org_id = get_user_org_id()));
CREATE POLICY delete_requests_select ON public.delete_requests FOR SELECT TO authenticated USING ((org_id = get_user_org_id()));
CREATE POLICY "Users can delete diesel purchases" ON public.diesel_purchases FOR DELETE TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can insert diesel purchases" ON public.diesel_purchases FOR INSERT TO authenticated WITH CHECK ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can view diesel purchases in their org" ON public.diesel_purchases FOR SELECT TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY diesel_purchases_update ON public.diesel_purchases FOR UPDATE TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can delete diesel_stock" ON public.diesel_stock FOR DELETE TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can insert diesel_stock" ON public.diesel_stock FOR INSERT TO authenticated WITH CHECK ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can read diesel_stock for their org" ON public.diesel_stock FOR SELECT TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can update diesel_stock" ON public.diesel_stock FOR UPDATE TO authenticated USING ((shift_report_id IN ( SELECT sr.id
   FROM ((shift_reports sr
     JOIN plants p ON ((sr.plant_id = p.id)))
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_isolation ON public.dispatch_pellets FOR ALL TO public USING ((dispatch_id IN ( SELECT vehicle_dispatches.id
   FROM vehicle_dispatches
  WHERE (vehicle_dispatches.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.employees FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY "Users can read equipment for their org plants" ON public.equipment FOR SELECT TO authenticated USING ((plant_id IN ( SELECT p.id
   FROM ((plants p
     JOIN organizations o ON ((p.org_id = o.id)))
     JOIN employees e ON ((e.org_id = o.id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY equipment_delete ON public.equipment FOR DELETE TO authenticated USING ((plant_id IN ( SELECT p.id
   FROM (plants p
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY equipment_insert ON public.equipment FOR INSERT TO authenticated WITH CHECK ((plant_id IN ( SELECT p.id
   FROM (plants p
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY equipment_update ON public.equipment FOR UPDATE TO authenticated USING ((plant_id IN ( SELECT p.id
   FROM (plants p
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((plant_id IN ( SELECT p.id
   FROM (plants p
     JOIN employees e ON ((e.org_id = p.org_id)))
  WHERE (e.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_isolation ON public.equipment_diesel_log FOR ALL TO public USING ((shift_report_id IN ( SELECT shift_reports.id
   FROM shift_reports
  WHERE (shift_reports.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.issues FOR ALL TO public USING ((shift_report_id IN ( SELECT shift_reports.id
   FROM shift_reports
  WHERE (shift_reports.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.machine_production FOR ALL TO public USING ((shift_report_id IN ( SELECT shift_reports.id
   FROM shift_reports
  WHERE (shift_reports.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.machines FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY employee_own_notification_prefs ON public.notification_preferences FOR ALL TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY service_role_read_notification_prefs ON public.notification_preferences FOR SELECT TO service_role USING (true);
CREATE POLICY org_isolation ON public.organizations FOR ALL TO public USING ((id = get_user_org_id())) WITH CHECK ((id = get_user_org_id()));
CREATE POLICY org_isolation ON public.pellet_stock FOR ALL TO public USING ((shift_report_id IN ( SELECT shift_reports.id
   FROM shift_reports
  WHERE (shift_reports.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.pellet_types FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.plants FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY "Service role can read all push subscriptions" ON public.push_subscriptions FOR SELECT TO service_role USING (true);
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.auth_user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM employees
  WHERE (employees.auth_user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_isolation ON public.raw_material_purchases FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.raw_material_types FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.raw_material_usage FOR ALL TO public USING ((shift_report_id IN ( SELECT shift_reports.id
   FROM shift_reports
  WHERE (shift_reports.plant_id IN ( SELECT plants.id
           FROM plants
          WHERE (plants.org_id = get_user_org_id()))))));
CREATE POLICY org_isolation ON public.shift_mix_compositions FOR ALL TO public USING ((mix_id IN ( SELECT shift_mixes.id
   FROM shift_mixes
  WHERE (shift_mixes.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.shift_mix_machine_usage FOR ALL TO public USING ((mix_id IN ( SELECT shift_mixes.id
   FROM shift_mixes
  WHERE (shift_mixes.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.shift_mixes FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.shift_reports FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.spare_parts FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY "org members can manage spare_parts_plant_config" ON public.spare_parts_plant_config FOR ALL TO public USING ((org_id = get_user_org_id())) WITH CHECK ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.spare_parts_purchases FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY "org members can manage reorder requests" ON public.spare_parts_reorder_requests FOR ALL TO public USING ((org_id = get_user_org_id())) WITH CHECK ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.spare_parts_suppliers FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.spare_parts_usage FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.suppliers FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_members_can_access_tasks ON public.tasks FOR ALL TO public USING ((org_id = get_user_org_id())) WITH CHECK ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.transporters FOR ALL TO public USING ((org_id = get_user_org_id()));
CREATE POLICY org_isolation ON public.vehicle_dispatches FOR ALL TO public USING ((plant_id IN ( SELECT plants.id
   FROM plants
  WHERE (plants.org_id = get_user_org_id()))));
CREATE POLICY org_isolation ON public.vehicles FOR ALL TO public USING ((plant_id IN ( SELECT p.id
   FROM plants p
  WHERE (p.org_id = get_user_org_id()))));
