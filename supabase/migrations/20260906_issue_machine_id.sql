-- Persist optional machine_id on shift-report issues.
-- The wizard already collects it; the save RPC previously dropped the column.

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
    INSERT INTO issues (shift_report_id, issue_type, description, severity, photo_url, machine_id)
    SELECT p_report_id, x.issue_type, x.description, x.severity, x.photo_url, x.machine_id
    FROM jsonb_to_recordset(p_payload->'issues') AS x(
      issue_type text, description text, severity text, photo_url text, machine_id uuid
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
