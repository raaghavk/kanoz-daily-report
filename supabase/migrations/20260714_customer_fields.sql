ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_person text,       -- their point of contact
  ADD COLUMN IF NOT EXISTS contact_phone text,         -- that person's number
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS account_owner text,         -- OUR person who acquired/owns this customer
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notes text;
