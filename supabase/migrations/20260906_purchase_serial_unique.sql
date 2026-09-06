-- Unique weighbridge serial (parchi no) per plant among live purchases.
--
-- Scope: (plant_id, canonical serial). Two plants may share the same serial.
-- Soft-deleted rows are excluded so a deleted parchi can be re-entered.
--
-- Canonical serial (normalize_purchase_serial):
--   trim whitespace; digit-only values drop leading zeros ("025194" -> "25194");
--   all-zeros become "0"; alphanumeric values are trimmed only ("A001" stays "A001").
-- Stored serial_no is rewritten to that form by a BEFORE trigger so UI/search
-- match the unique index. The unique index uses the expression so padded
-- inserts still collide even if the trigger is bypassed.
--
-- Cleanup (soft-delete is_deleted / deleted_at — never hard delete):
-- keep the earlier / richer-docs row. All pairs were same date+supplier+qty,
-- payment Pending, no tally_vouchers. Double-submits are milliseconds apart.

CREATE OR REPLACE FUNCTION public.normalize_purchase_serial(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN btrim(raw) = '' THEN NULL
    WHEN btrim(raw) ~ '^[0-9]+$' THEN
      COALESCE(NULLIF(ltrim(btrim(raw), '0'), ''), '0')
    ELSE btrim(raw)
  END;
$$;

COMMENT ON FUNCTION public.normalize_purchase_serial(text) IS
  'Canonical RM purchase serial: trim; strip leading zeros on digit-only values.';

-- Keep / drop (drop = soft-delete). Keep id is the earlier created_at row;
-- near-dupes also keep the richer vehicle/photo payload.
--
-- keep eea437ec-1a1c-46a3-8069-57fd223609c6  2026-07-06 022301 Vinod Singh
-- drop 2477df4c-5751-4c90-8874-a629153ac0db  2026-07-06 22301  (near-dupe)
-- keep 6034e334-1d18-462d-a191-ec546614f41a  2026-07-18 937    Sudhanshu
-- drop 8d6a6d78-a478-4a8b-924a-ec6ca8d0fa13
-- keep 5a9ea147-b876-48b7-87ca-bedce6d554d5  2026-07-18 938    Sudhanshu
-- drop 830d2134-4b1d-425f-837b-0965375f969a
-- keep 600565c3-3a4b-4fe6-ad7a-a43b89006cee  2026-07-19 975    Sudhanshu
-- drop 346d32f6-ddfa-475c-bf82-1490af93bbce
-- keep b98e7dd1-1ecb-4ed0-bf94-cb5585b8ca77  2026-07-31 1721   Sudhanshu
-- drop 0f28e535-adf6-4d7d-9fa4-d8489809b0a5
-- keep beb8a28f-7838-4a47-b8fc-137d7f268bc3  2026-08-01 024405 Ravinder Singh
-- drop 76653ecc-2d49-4b1f-9314-00801740af9e
-- keep 41718504-937c-4b3c-8c96-c45553120307  2026-08-01 1801   Sudhanshu
-- drop 4cf02d30-863f-4503-be8b-5f2061cdcf8a
-- keep e34c6e4e-6e05-41c6-8d7f-9d14989c34f5  2026-08-01 42273  Sudhanshu
-- drop ea8646b3-f20f-46fb-9282-f7cf58b3041e
-- keep 818be6fc-928f-401e-9d86-e58cb8dac358  2026-08-11 025194 Robin Singh
-- drop 037e2ac3-b7ec-4ce3-84c9-25af70ae1901  2026-08-11 25194  (near-dupe)

UPDATE public.raw_material_purchases AS loser
SET
  is_deleted = true,
  deleted_at = now(),
  remarks = NULLIF(trim(both from concat_ws(' ', loser.remarks,
    '[Soft-deleted as duplicate of ' || keeper.keep_id || ']')), '')
FROM (VALUES
  ('2477df4c-5751-4c90-8874-a629153ac0db'::uuid, 'eea437ec-1a1c-46a3-8069-57fd223609c6'::uuid),
  ('8d6a6d78-a478-4a8b-924a-ec6ca8d0fa13'::uuid, '6034e334-1d18-462d-a191-ec546614f41a'::uuid),
  ('830d2134-4b1d-425f-837b-0965375f969a'::uuid, '5a9ea147-b876-48b7-87ca-bedce6d554d5'::uuid),
  ('346d32f6-ddfa-475c-bf82-1490af93bbce'::uuid, '600565c3-3a4b-4fe6-ad7a-a43b89006cee'::uuid),
  ('0f28e535-adf6-4d7d-9fa4-d8489809b0a5'::uuid, 'b98e7dd1-1ecb-4ed0-bf94-cb5585b8ca77'::uuid),
  ('76653ecc-2d49-4b1f-9314-00801740af9e'::uuid, 'beb8a28f-7838-4a47-b8fc-137d7f268bc3'::uuid),
  ('4cf02d30-863f-4503-be8b-5f2061cdcf8a'::uuid, '41718504-937c-4b3c-8c96-c45553120307'::uuid),
  ('ea8646b3-f20f-46fb-9282-f7cf58b3041e'::uuid, 'e34c6e4e-6e05-41c6-8d7f-9d14989c34f5'::uuid),
  ('037e2ac3-b7ec-4ce3-84c9-25af70ae1901'::uuid, '818be6fc-928f-401e-9d86-e58cb8dac358'::uuid)
) AS keeper(drop_id, keep_id)
WHERE loser.id = keeper.drop_id
  AND COALESCE(loser.is_deleted, false) = false;

-- Canonicalize stored serials (live and already-deleted) so lists match the unique key.
UPDATE public.raw_material_purchases
SET serial_no = public.normalize_purchase_serial(serial_no)
WHERE serial_no IS DISTINCT FROM public.normalize_purchase_serial(serial_no);

CREATE OR REPLACE FUNCTION public.raw_material_purchases_normalize_serial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.serial_no := public.normalize_purchase_serial(NEW.serial_no);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_raw_material_purchases_normalize_serial ON public.raw_material_purchases;
CREATE TRIGGER trg_raw_material_purchases_normalize_serial
  BEFORE INSERT OR UPDATE OF serial_no ON public.raw_material_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.raw_material_purchases_normalize_serial();

-- Partial unique: live rows only. Expression uses the same canonical form as the trigger.
CREATE UNIQUE INDEX IF NOT EXISTS raw_material_purchases_plant_serial_active_idx
  ON public.raw_material_purchases (plant_id, (public.normalize_purchase_serial(serial_no)))
  WHERE is_deleted IS DISTINCT FROM true
    AND public.normalize_purchase_serial(serial_no) IS NOT NULL;
