-- Push notification subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id)
);

-- Index for looking up subscriptions by employee
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee_id ON push_subscriptions(employee_id);

-- Add Google Sheet ID column to plants table (for Sheets sync)
ALTER TABLE plants ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage their own subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

-- Policy: service role can read all (for edge functions)
CREATE POLICY "Service role can read all push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.role() = 'service_role');
