-- Storage plots (land parcels attached to a plant) + RM stock transfers
-- Tally export review queue
-- Transactional shift-report child replace

-- ── Plots ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS storage_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'storage' CHECK (kind IN ('factory', 'storage')),
  is_primary boolean NOT NULL DEFAULT false,
  address text,
  notes text,
  distance_m numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_plots_one_primary
  ON storage_plots (plant_id) WHERE is_primary AND is_active;

CREATE INDEX IF NOT EXISTS storage_plots_plant_idx ON storage_plots (plant_id) WHERE is_active;

ALTER TABLE storage_plots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON storage_plots;
CREATE POLICY org_isolation ON storage_plots
  USING (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()))
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()));

INSERT INTO storage_plots (plant_id, name, kind, is_primary, notes)
SELECT p.id, 'Main factory land', 'factory', true, 'Primary plot — production, usage, and default unloading'
FROM plants p
WHERE NOT EXISTS (
  SELECT 1 FROM storage_plots sp WHERE sp.plant_id = p.id AND sp.is_primary
);

CREATE OR REPLACE FUNCTION ensure_primary_storage_plot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO storage_plots (plant_id, name, kind, is_primary, notes)
  VALUES (NEW.id, 'Main factory land', 'factory', true, 'Primary plot — production, usage, and default unloading');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS plants_ensure_primary_plot ON plants;
CREATE TRIGGER plants_ensure_primary_plot
  AFTER INSERT ON plants
  FOR EACH ROW EXECUTE FUNCTION ensure_primary_storage_plot();

ALTER TABLE raw_material_purchases
  ADD COLUMN IF NOT EXISTS plot_id uuid REFERENCES storage_plots(id);

UPDATE raw_material_purchases p
SET plot_id = sp.id
FROM storage_plots sp
WHERE p.plot_id IS NULL
  AND sp.plant_id = p.plant_id
  AND sp.is_primary;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  from_plot_id uuid NOT NULL REFERENCES storage_plots(id),
  to_plot_id uuid NOT NULL REFERENCES storage_plots(id),
  raw_material_type_id uuid REFERENCES raw_material_types(id),
  raw_material_name text,
  quantity_kg numeric NOT NULL CHECK (quantity_kg > 0),
  transfer_date date NOT NULL,
  vehicle_number text,
  notes text,
  created_by uuid REFERENCES employees(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_transfers_different_plots CHECK (from_plot_id <> to_plot_id)
);

CREATE INDEX IF NOT EXISTS stock_transfers_plant_date_idx
  ON stock_transfers (plant_id, transfer_date) WHERE is_deleted = false;

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON stock_transfers;
CREATE POLICY org_isolation ON stock_transfers
  USING (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()))
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()));

-- ── Tally export ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tally_settings (
  plant_id uuid PRIMARY KEY REFERENCES plants(id) ON DELETE CASCADE,
  company_name text,
  gstin text,
  tally_gateway_url text,
  purchase_ledger text DEFAULT 'Purchase Accounts',
  sales_ledger text DEFAULT 'Sales Accounts',
  cash_ledger text DEFAULT 'Cash',
  bank_ledger text DEFAULT 'Bank',
  sundry_creditors_ledger text DEFAULT 'Sundry Creditors',
  sundry_debtors_ledger text DEFAULT 'Sundry Debtors',
  freight_ledger text DEFAULT 'Freight Inward',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tally_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON tally_settings;
CREATE POLICY org_isolation ON tally_settings
  USING (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()))
  WITH CHECK (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()));

CREATE TABLE IF NOT EXISTS tally_ledger_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('supplier', 'customer', 'transporter', 'expense')),
  entity_id uuid,
  entity_name text,
  tally_ledger_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tally_ledger_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON tally_ledger_maps;
CREATE POLICY org_isolation ON tally_ledger_maps
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE TABLE IF NOT EXISTS tally_export_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'exported', 'posted')),
  xml text,
  voucher_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES employees(id),
  reviewed_by uuid REFERENCES employees(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tally_export_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON tally_export_batches;
CREATE POLICY org_isolation ON tally_export_batches
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

CREATE TABLE IF NOT EXISTS tally_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES tally_export_batches(id) ON DELETE CASCADE,
  voucher_type text NOT NULL,
  voucher_date date NOT NULL,
  source_table text NOT NULL,
  source_id uuid,
  party_ledger text,
  account_ledger text,
  amount numeric NOT NULL,
  narration text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'skipped', 'included')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tally_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON tally_vouchers;
CREATE POLICY org_isolation ON tally_vouchers
  USING (batch_id IN (SELECT id FROM tally_export_batches WHERE org_id = get_user_org_id()))
  WITH CHECK (batch_id IN (SELECT id FROM tally_export_batches WHERE org_id = get_user_org_id()));

-- ── Transactional child replace for shift reports ────────────────────────────
CREATE OR REPLACE FUNCTION replace_shift_report_children(p_report_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  mix jsonb;
  mix_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM shift_reports sr
    JOIN plants p ON p.id = sr.plant_id
    WHERE sr.id = p_report_id AND p.org_id = get_user_org_id()
  ) THEN
    RAISE EXCEPTION 'shift report not found';
  END IF;

  DELETE FROM machine_production WHERE shift_report_id = p_report_id;
  DELETE FROM shift_mix_machine_usage WHERE shift_report_id = p_report_id;
  DELETE FROM shift_mixes WHERE shift_report_id = p_report_id;
  DELETE FROM raw_material_usage WHERE shift_report_id = p_report_id;
  DELETE FROM processing_runs WHERE shift_report_id = p_report_id;
  DELETE FROM equipment_diesel_log WHERE shift_report_id = p_report_id;
  DELETE FROM pellet_stock WHERE shift_report_id = p_report_id;
  DELETE FROM issues WHERE shift_report_id = p_report_id;
  DELETE FROM diesel_purchases WHERE shift_report_id = p_report_id;
  DELETE FROM diesel_stock WHERE shift_report_id = p_report_id;

  IF jsonb_typeof(p_payload->'machine_production') = 'array' AND jsonb_array_length(p_payload->'machine_production') > 0 THEN
    INSERT INTO machine_production (
      shift_report_id, machine_id, did_not_run, hours_run, from_time, to_time,
      total_hours, breakdown_hours, remarks, production_mt, pellet_type_name
    )
    SELECT p_report_id,
      x.machine_id, COALESCE(x.did_not_run, false), x.hours_run, x.from_time, x.to_time,
      x.total_hours, COALESCE(x.breakdown_hours, 0), x.remarks, x.production_mt, x.pellet_type_name
    FROM jsonb_to_recordset(p_payload->'machine_production') AS x(
      machine_id uuid, did_not_run boolean, hours_run numeric, from_time text, to_time text,
      total_hours numeric, breakdown_hours numeric, remarks text, production_mt numeric, pellet_type_name text
    );
  END IF;

  IF jsonb_typeof(p_payload->'raw_material_usage') = 'array' AND jsonb_array_length(p_payload->'raw_material_usage') > 0 THEN
    INSERT INTO raw_material_usage (shift_report_id, raw_material_type_id, quantity_kg, opening_kg, purchased_kg, closing_kg)
    SELECT p_report_id, x.raw_material_type_id, x.quantity_kg, x.opening_kg, x.purchased_kg, x.closing_kg
    FROM jsonb_to_recordset(p_payload->'raw_material_usage') AS x(
      raw_material_type_id uuid, quantity_kg numeric, opening_kg numeric, purchased_kg numeric, closing_kg numeric
    );
  END IF;

  IF jsonb_typeof(p_payload->'processing_runs') = 'array' AND jsonb_array_length(p_payload->'processing_runs') > 0 THEN
    INSERT INTO processing_runs (
      shift_report_id, plant_id, org_id, route_id, input_material, input_kg,
      output_material, output_kg, yield_pct, machine_hours, note
    )
    SELECT p_report_id, x.plant_id, x.org_id, x.route_id, x.input_material, x.input_kg,
      x.output_material, x.output_kg, x.yield_pct, COALESCE(x.machine_hours, '{}'::jsonb), x.note
    FROM jsonb_to_recordset(p_payload->'processing_runs') AS x(
      plant_id uuid, org_id uuid, route_id uuid, input_material text, input_kg numeric,
      output_material text, output_kg numeric, yield_pct numeric, machine_hours jsonb, note text
    );
  END IF;

  IF jsonb_typeof(p_payload->'equipment_diesel_log') = 'array' AND jsonb_array_length(p_payload->'equipment_diesel_log') > 0 THEN
    INSERT INTO equipment_diesel_log (
      shift_report_id, equipment_id, equipment_name, opening_litres, added_litres,
      used_litres, closing_litres, hours_worked
    )
    SELECT p_report_id, x.equipment_id, x.equipment_name, x.opening_litres, x.added_litres,
      x.used_litres, x.closing_litres, x.hours_worked
    FROM jsonb_to_recordset(p_payload->'equipment_diesel_log') AS x(
      equipment_id uuid, equipment_name text, opening_litres numeric, added_litres numeric,
      used_litres numeric, closing_litres numeric, hours_worked numeric
    );
  END IF;

  IF jsonb_typeof(p_payload->'pellet_stock') = 'array' AND jsonb_array_length(p_payload->'pellet_stock') > 0 THEN
    INSERT INTO pellet_stock (
      shift_report_id, pellet_type_id, opening_mt, production_mt, dispatch_mt,
      wastage_mt, adjustment_mt, adjustment_note
    )
    SELECT p_report_id, x.pellet_type_id, x.opening_mt, x.production_mt, x.dispatch_mt,
      x.wastage_mt, x.adjustment_mt, x.adjustment_note
    FROM jsonb_to_recordset(p_payload->'pellet_stock') AS x(
      pellet_type_id uuid, opening_mt numeric, production_mt numeric, dispatch_mt numeric,
      wastage_mt numeric, adjustment_mt numeric, adjustment_note text
    );
  END IF;

  IF jsonb_typeof(p_payload->'issues') = 'array' AND jsonb_array_length(p_payload->'issues') > 0 THEN
    INSERT INTO issues (shift_report_id, issue_type, description, severity, photo_url)
    SELECT p_report_id, x.issue_type, x.description, x.severity, x.photo_url
    FROM jsonb_to_recordset(p_payload->'issues') AS x(
      issue_type text, description text, severity text, photo_url text
    );
  END IF;

  IF jsonb_typeof(p_payload->'diesel_stock') = 'object' AND (p_payload->'diesel_stock') IS NOT NULL THEN
    INSERT INTO diesel_stock (shift_report_id, opening_litres, purchased_litres, purchase_cost, used_litres, closing_litres)
    SELECT p_report_id, x.opening_litres, x.purchased_litres, x.purchase_cost, x.used_litres, x.closing_litres
    FROM jsonb_to_recordset(jsonb_build_array(p_payload->'diesel_stock')) AS x(
      opening_litres numeric, purchased_litres numeric, purchase_cost numeric, used_litres numeric, closing_litres numeric
    );
  END IF;

  IF jsonb_typeof(p_payload->'diesel_purchases') = 'array' AND jsonb_array_length(p_payload->'diesel_purchases') > 0 THEN
    INSERT INTO diesel_purchases (shift_report_id, litres, cost_per_litre, total_cost, receipt_url, purchase_time)
    SELECT p_report_id, x.litres, x.cost_per_litre, x.total_cost, x.receipt_url, x.purchase_time
    FROM jsonb_to_recordset(p_payload->'diesel_purchases') AS x(
      litres numeric, cost_per_litre numeric, total_cost numeric, receipt_url text, purchase_time text
    );
  END IF;

  IF jsonb_typeof(p_payload->'mixes') = 'array' THEN
    FOR mix IN SELECT value FROM jsonb_array_elements(p_payload->'mixes')
    LOOP
      INSERT INTO shift_mixes (
        shift_report_id, plant_id, org_id, name, type, opening_kg, prepared_kg,
        used_kg, closing_kg, derived_pellet_name, derived_gcv, derived_grade
      ) VALUES (
        p_report_id,
        (mix->>'plant_id')::uuid,
        (mix->>'org_id')::uuid,
        mix->>'name',
        mix->>'type',
        COALESCE((mix->>'opening_kg')::numeric, 0),
        COALESCE((mix->>'prepared_kg')::numeric, 0),
        COALESCE((mix->>'used_kg')::numeric, 0),
        COALESCE((mix->>'closing_kg')::numeric, 0),
        mix->>'derived_pellet_name',
        NULLIF(mix->>'derived_gcv', '')::numeric,
        mix->>'derived_grade'
      ) RETURNING id INTO mix_id;

      IF jsonb_typeof(mix->'compositions') = 'array' AND jsonb_array_length(mix->'compositions') > 0 THEN
        INSERT INTO shift_mix_compositions (mix_id, raw_material_type_id, raw_material_name, quantity_kg)
        SELECT mix_id, c.raw_material_type_id, c.raw_material_name, c.quantity_kg
        FROM jsonb_to_recordset(mix->'compositions') AS c(
          raw_material_type_id uuid, raw_material_name text, quantity_kg numeric
        );
      END IF;

      IF jsonb_typeof(mix->'machine_usages') = 'array' AND jsonb_array_length(mix->'machine_usages') > 0 THEN
        INSERT INTO shift_mix_machine_usage (mix_id, shift_report_id, machine_id, quantity_kg)
        SELECT mix_id, p_report_id, u.machine_id, u.quantity_kg
        FROM jsonb_to_recordset(mix->'machine_usages') AS u(
          machine_id uuid, quantity_kg numeric
        );
      END IF;
    END LOOP;
  END IF;
END $$;

REVOKE ALL ON FUNCTION replace_shift_report_children(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_shift_report_children(uuid, jsonb) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON storage_plots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tally_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tally_ledger_maps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tally_export_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tally_vouchers TO authenticated;
