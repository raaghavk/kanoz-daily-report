const PERMISSIONS = {
  admin: {
    create_report: true,
    create_dispatch: true,
    create_purchase: true,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    export: true,
    manage_users: true,
    plant_settings: true,
    switch_plant: true,
  },
  supervisor: {
    create_report: true,
    create_dispatch: true,
    create_purchase: true,
    view_reports: true,
    view_dispatches: true,
    view_purchases: true,
    export: false,
    manage_users: false,
    plant_settings: false,
    switch_plant: false,
  },
  purchase_manager: {
    create_report: false,
    create_dispatch: false,
    create_purchase: true,
    view_reports: true,
    view_dispatches: false,
    view_purchases: true,
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
    export: true,
    manage_users: false,
    plant_settings: false,
    switch_plant: false,
  },
}

export function can(role, action) {
  return !!PERMISSIONS[role]?.[action]
}

export const ROLE_OPTIONS = [
  { value: 'supervisor', label: 'Supervisor', description: 'Full plant operations — reports, dispatches, purchases' },
  { value: 'admin', label: 'Admin', description: 'Everything + user management & plant settings' },
  { value: 'purchase_manager', label: 'Purchase Manager', description: 'Raw material purchases only' },
  { value: 'accountant', label: 'Accountant', description: 'Read-only access + export to CSV/Sheets' },
]
