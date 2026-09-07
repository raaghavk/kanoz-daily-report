/** Tables that a delete-request approval should deactivate. */
export const DELETE_TABLE_MAP = {
  purchase: 'raw_material_purchases',
  dispatch: 'vehicle_dispatches',
  shift_report: 'shift_reports',
  asset: 'assets',
  spare_part: 'spare_parts',
}

/**
 * Soft-delete / deactivate patch for the live schema of each entity type.
 * Purchases, dispatches, and shift reports use is_deleted.
 * Assets have is_active + deleted_at/deleted_by (no is_deleted).
 * Spare parts catalogue rows only have is_active (table is spare_parts, not spare_part_items).
 */
export function deactivateFields(entityType, { employeeId, deletedAt } = {}) {
  if (entityType === 'spare_part') {
    return { is_active: false }
  }
  if (entityType === 'asset') {
    return { is_active: false, deleted_by: employeeId || null, deleted_at: deletedAt || null }
  }
  return { is_deleted: true, deleted_by: employeeId || null, deleted_at: deletedAt || null }
}

export function alreadyDeletedLabel(entityType, row) {
  if (!row) return null
  if (entityType === 'asset' || entityType === 'spare_part') {
    return row.is_active === false || row.deleted_at ? 'Already deleted' : null
  }
  return row.is_deleted ? 'Already deleted' : null
}
