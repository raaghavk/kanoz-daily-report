-- Custom roles: DB-driven roles table replacing hardcoded PERMISSIONS matrix.
-- Org-isolated via RLS. Seeds the 5 built-in roles for every existing org.

CREATE TABLE IF NOT EXISTS roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  key text,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  is_default boolean default false,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_roles_org_id ON roles(org_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON roles;
CREATE POLICY org_isolation ON roles
  FOR ALL
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

-- Seed built-in roles for every existing org, matching the current PERMISSIONS matrix.
-- Guarded with NOT EXISTS so re-running does not duplicate.

INSERT INTO roles (org_id, key, name, description, permissions, is_default)
SELECT o.id, 'admin', 'Admin',
  'Everything + cross-plant access & user management',
  '["create_report","view_reports","create_dispatch","view_dispatches","create_purchase","view_purchases","view_spare_parts","create_spare_parts","assign_tasks","export","manage_users","plant_settings","switch_plant","mark_attendance_others"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.org_id = o.id AND r.key = 'admin');

INSERT INTO roles (org_id, key, name, description, permissions, is_default)
SELECT o.id, 'plant_manager', 'Plant Manager',
  'Full access for their plant — all operations, export, manage team',
  '["create_report","view_reports","create_dispatch","view_dispatches","create_purchase","view_purchases","view_spare_parts","create_spare_parts","assign_tasks","export","manage_users","plant_settings","mark_attendance_others"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.org_id = o.id AND r.key = 'plant_manager');

INSERT INTO roles (org_id, key, name, description, permissions, is_default)
SELECT o.id, 'supervisor', 'Supervisor',
  'Full plant operations — reports, dispatches, purchases',
  '["create_report","view_reports","create_dispatch","view_dispatches","create_purchase","view_purchases","view_spare_parts","create_spare_parts","export","mark_attendance_others"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.org_id = o.id AND r.key = 'supervisor');

INSERT INTO roles (org_id, key, name, description, permissions, is_default)
SELECT o.id, 'purchase_manager', 'Purchase Manager',
  'Raw material purchases only',
  '["create_purchase","view_reports","view_purchases"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.org_id = o.id AND r.key = 'purchase_manager');

INSERT INTO roles (org_id, key, name, description, permissions, is_default)
SELECT o.id, 'accountant', 'Accountant',
  'Read-only access + export to CSV/Sheets',
  '["view_reports","view_dispatches","view_purchases","view_spare_parts","export"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.org_id = o.id AND r.key = 'accountant');
