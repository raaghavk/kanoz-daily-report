const PERMISSIONS = {
  admin: {
    create_report: true,
    create_dispatch: true,
    create_purchase: true,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    view_spare_parts: true,
    create_spare_parts: true,
    export: true,
    manage_users: true,
    plant_settings: true,
    switch_plant: true,
    assign_tasks: true,
  },
  plant_manager: {
    create_report: true,
    create_dispatch: true,
    create_purchase: true,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    view_spare_parts: true,
    create_spare_parts: true,
    export: true,
    manage_users: false,  // user/role management is admin-only
    plant_settings: true,
    switch_plant: false,
    assign_tasks: true,
  },
  supervisor: {
    create_report: true,
    create_dispatch: true,
    create_purchase: true,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    view_spare_parts: true,
    create_spare_parts: true,
    export: true,
    manage_users: false,
    plant_settings: false,
    switch_plant: false,
    assign_tasks: false,
  },
  purchase_manager: {
    create_report: false,
    create_dispatch: false,
    create_purchase: true,
    view_reports: true,
    view_dispatches: false,
    view_purchases: true,
    view_spare_parts: false,
    create_spare_parts: false,
    export: false,
    manage_users: false,
    plant_settings: false,
    switch_plant: false,
  },
  accountant: {
    create_report: false,
    create_dispatch: false,
    create_purchase: false,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    view_spare_parts: true,
    create_spare_parts: false,
    export: true,
    manage_users: false,
    plant_settings: false,
    switch_plant: false,
  },
}

// Dynamic (DB-driven) roles cache. Populated by AuthContext from the `roles`
// table for the current org. Map keyed by role key AND/OR role name ->
// array of permission keys. When absent (or a given role is missing), can()
// falls back to the hardcoded PERMISSIONS matrix below for safety.
let DYNAMIC_ROLES = null

export function setDynamicRoles(map) {
  DYNAMIC_ROLES = map
}

export function can(role, action) {
  if (DYNAMIC_ROLES && Array.isArray(DYNAMIC_ROLES[role])) {
    return DYNAMIC_ROLES[role].includes(action)
  }
  return !!PERMISSIONS[role]?.[action]
}

// Ordered permission catalog (key -> label) shown as checkboxes in the Roles UI.
export const PERMISSION_CATALOG = [
  { key: 'create_report', label: 'Create production logs' },
  { key: 'view_reports', label: 'View production logs' },
  { key: 'create_dispatch', label: 'Create dispatches' },
  { key: 'view_dispatches', label: 'View dispatches' },
  { key: 'create_purchase', label: 'Create purchases' },
  { key: 'view_purchases', label: 'View purchases' },
  { key: 'view_spare_parts', label: 'View spare parts & assets' },
  { key: 'create_spare_parts', label: 'Manage spare parts & assets' },
  { key: 'assign_tasks', label: 'Assign tasks' },
  { key: 'export', label: 'Export data' },
  { key: 'manage_users', label: 'User management' },
  { key: 'plant_settings', label: 'Plant settings' },
  { key: 'switch_plant', label: 'Switch plants' },
  { key: 'mark_attendance_others', label: 'Mark attendance for others' },
]

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Everything + cross-plant access & user management' },
  { value: 'plant_manager', label: 'Plant Manager', description: 'Full access for their plant — all operations, export, manage team' },
  { value: 'supervisor', label: 'Supervisor', description: 'Full plant operations — reports, dispatches, purchases' },
  { value: 'purchase_manager', label: 'Purchase Manager', description: 'Raw material purchases only' },
  { value: 'accountant', label: 'Accountant', description: 'Read-only access + export to CSV/Sheets' },
]
