/** Nested select → in-memory join map for the demo adapter. */
export const RELATIONS = {
  shift_reports: {
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
    employees: { table: 'employees', local: 'supervisor_id', foreign: 'id', many: false },
    'employees!supervisor_id': { table: 'employees', local: 'supervisor_id', foreign: 'id', many: false },
    'employees!created_by': { table: 'employees', local: 'created_by', foreign: 'id', many: false },
    'employees!last_edited_by': { table: 'employees', local: 'last_edited_by', foreign: 'id', many: false },
    creator: { table: 'employees', local: 'created_by', foreign: 'id', many: false },
    editor: { table: 'employees', local: 'last_edited_by', foreign: 'id', many: false },
    issues: { table: 'issues', local: 'id', foreign: 'shift_report_id', many: true },
  },
  vehicle_dispatches: {
    dispatch_pellets: { table: 'dispatch_pellets', local: 'id', foreign: 'dispatch_id', many: true },
    customers: { table: 'customers', local: 'customer_id', foreign: 'id', many: false },
  },
  dispatch_pellets: {
    pellet_types: { table: 'pellet_types', local: 'pellet_type_id', foreign: 'id', many: false },
  },
  raw_material_purchases: {
    suppliers: { table: 'suppliers', local: 'supplier_id', foreign: 'id', many: false },
    raw_material_types: { table: 'raw_material_types', local: 'raw_material_type_id', foreign: 'id', many: false },
    transporters: { table: 'transporters', local: 'transporter_id', foreign: 'id', many: false },
  },
  machine_production: {
    machines: { table: 'machines', local: 'machine_id', foreign: 'id', many: false },
  },
  raw_material_usage: {
    raw_material_types: { table: 'raw_material_types', local: 'raw_material_type_id', foreign: 'id', many: false },
  },
  pellet_stock: {
    pellet_types: { table: 'pellet_types', local: 'pellet_type_id', foreign: 'id', many: false },
  },
  issues: {
    machines: { table: 'machines', local: 'machine_id', foreign: 'id', many: false },
  },
  equipment_diesel_log: {
    equipment: { table: 'equipment', local: 'equipment_id', foreign: 'id', many: false },
  },
  tasks: {
    assignee: { table: 'employees', local: 'assigned_to_employee_id', foreign: 'id', many: false },
    assigner: { table: 'employees', local: 'assigned_by_employee_id', foreign: 'id', many: false },
    plant: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
  },
  employees: {
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
  },
  process_routes: {
    process_route_stages: { table: 'process_route_stages', local: 'id', foreign: 'route_id', many: true },
  },
  shift_mixes: {
    shift_mix_compositions: { table: 'shift_mix_compositions', local: 'id', foreign: 'mix_id', many: true },
    shift_mix_machine_usage: { table: 'shift_mix_machine_usage', local: 'id', foreign: 'mix_id', many: true },
  },
  spare_parts_purchases: {
    spare_parts_suppliers: { table: 'spare_parts_suppliers', local: 'supplier_id', foreign: 'id', many: false },
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
    spare_parts: { table: 'spare_parts', local: 'part_id', foreign: 'id', many: false },
  },
  spare_parts_usage: {
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
    spare_parts: { table: 'spare_parts', local: 'part_id', foreign: 'id', many: false },
  },
  spare_parts_reorder_requests: {
    spare_parts: { table: 'spare_parts', local: 'part_id', foreign: 'id', many: false },
  },
  assets: {
    plants: { table: 'plants', local: 'plant_id', foreign: 'id', many: false },
  },
  asset_events: {
    assets: { table: 'assets', local: 'asset_id', foreign: 'id', many: false },
  },
}

export function splitTopLevel(str) {
  const parts = []
  let buf = ''
  let depth = 0
  for (const ch of str) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim())
      buf = ''
    } else {
      buf += ch
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

export function parseSelect(selectStr) {
  const raw = String(selectStr || '*').replace(/\s+/g, ' ').trim()
  if (!raw || raw === '*') return { star: true, columns: [], embeds: [] }
  const parts = splitTopLevel(raw)
  const columns = []
  const embeds = []
  let star = false
  for (const p of parts) {
    if (p === '*') {
      star = true
      continue
    }
    const embedMatch = p.match(/^(?:(\w+)\s*:\s*)?(\w+)(?:!([\w]+))?\((.*)\)$/s)
    if (embedMatch) {
      const [, alias, table, hint, inner] = embedMatch
      embeds.push({
        alias: alias || table,
        table,
        hint: hint || null,
        inner: parseSelect(inner || '*'),
      })
    } else {
      columns.push(p)
    }
  }
  return { star: star || (columns.length === 0 && embeds.length === 0), columns, embeds }
}

export function resolveRelation(parentTable, embed) {
  const map = RELATIONS[parentTable] || {}
  const keys = [
    embed.alias,
    embed.hint ? `${embed.table}!${embed.hint}` : null,
    embed.table,
  ].filter(Boolean)
  for (const k of keys) {
    if (map[k]) return map[k]
  }
  if (embed.hint) {
    let local = embed.hint
    if (local.endsWith('_fkey')) {
      local = local.replace(/_fkey$/, '').replace(new RegExp(`^${parentTable}_`), '')
    }
    return { table: embed.table, local, foreign: 'id', many: false }
  }
  if (embed.table.endsWith('_id')) {
    const inferred = embed.alias && embed.alias !== embed.table ? embed.alias : embed.table.slice(0, -3)
    return { table: inferred, local: embed.table, foreign: 'id', many: false }
  }
  const singular = parentTable.endsWith('s') ? parentTable.slice(0, -1) : parentTable
  return { table: embed.table, local: 'id', foreign: `${singular}_id`, many: true }
}
