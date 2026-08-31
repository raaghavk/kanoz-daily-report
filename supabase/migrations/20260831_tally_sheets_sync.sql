-- Sheets-backed Tally voucher sync (replaces XML-download-first workflow)

ALTER TABLE plants ADD COLUMN IF NOT EXISTS google_sheet_id text;

ALTER TABLE tally_settings
  ADD COLUMN IF NOT EXISTS sheets_tab text DEFAULT 'TallyVouchers',
  ADD COLUMN IF NOT EXISTS auto_post_gateway boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE tally_export_batches DROP CONSTRAINT IF EXISTS tally_export_batches_status_check;
ALTER TABLE tally_export_batches
  ADD CONSTRAINT tally_export_batches_status_check
  CHECK (status IN ('draft', 'reviewed', 'synced', 'exported', 'posted'));

ALTER TABLE tally_export_batches
  ADD COLUMN IF NOT EXISTS sheets_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheets_range text;
