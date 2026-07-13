-- Assembly-line configuration layer.
-- 1) Managed type dropdowns for machines & equipment. 2) Equipment fields fix
-- (fuel_type + rating; no MT/hr). 3) Configurable process routes (assembly
-- lines): input material -> [ordered machines] -> output material.
-- 4) Generalize processing_runs to be route-based.

-- 1. Managed type dropdowns for machines & equipment (per org, extendable)
CREATE TABLE IF NOT EXISTS machine_type_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  kind text not null check (kind in ('machine','equipment')),
  name text not null,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
ALTER TABLE machine_type_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON machine_type_options FOR ALL USING (org_id = get_user_org_id()) WITH CHECK (org_id = get_user_org_id());
CREATE INDEX IF NOT EXISTS idx_mto_org ON machine_type_options(org_id, kind);

-- 2. Equipment: add fuel_type; machines keep capacity_mt_per_hour+motor_hp. (Do not drop columns.)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS fuel_type text;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rating text; -- e.g. kVA for generator, tonnage for loader

-- 3. Configurable process routes (assembly lines): input material -> [ordered machines] -> output material
CREATE TABLE IF NOT EXISTS process_routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, plant_id uuid not null,
  name text not null,
  input_material_type_id uuid, input_material_name text,
  output_material_type_id uuid, output_material_name text,
  expected_yield_pct numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);
ALTER TABLE process_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON process_routes FOR ALL USING (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id())) WITH CHECK (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()));
CREATE INDEX IF NOT EXISTS idx_process_routes_plant ON process_routes(plant_id);

CREATE TABLE IF NOT EXISTS process_route_stages (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references process_routes(id) on delete cascade,
  seq int not null,
  machine_id uuid, machine_name text
);
ALTER TABLE process_route_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON process_route_stages FOR ALL USING (route_id IN (SELECT id FROM process_routes WHERE plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()))) WITH CHECK (route_id IN (SELECT id FROM process_routes WHERE plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id())));
CREATE INDEX IF NOT EXISTS idx_prs_route ON process_route_stages(route_id, seq);

-- 4. Generalize processing_runs (built earlier for hardcoded wood->sawdust) to be route-based
ALTER TABLE processing_runs ADD COLUMN IF NOT EXISTS route_id uuid;
ALTER TABLE processing_runs ADD COLUMN IF NOT EXISTS machine_hours jsonb; -- { "<machine_id>": <hours>, ... }
