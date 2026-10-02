/**
 * Purchase rows store both UUID FKs and denormalized text names
 * (`raw_material_type`, `supplier_name`). The edit form only loads *active*
 * masters, so a retired type/supplier is missing from the lookup list.
 * Saving then wrote `''` over the stored name (stock name-fallback, dashboard
 * grouping, delete-request titles).
 */

/** Live list name for `selectedId`, else the previously saved denormalized name. */
export function purchaseMasterName(selectedId, activeList, savedName) {
  if (!selectedId) return savedName || ''
  const found = (activeList || []).find(x => x.id === selectedId)
  if (found?.name) return found.name
  return savedName || ''
}

/**
 * Extra select option when `selectedId` is no longer in the active list.
 * Returns null when the id is already listed or empty.
 */
export function inactiveMasterOption(selectedId, activeList, savedName, kind = 'item') {
  if (!selectedId) return null
  if ((activeList || []).some(x => x.id === selectedId)) return null
  const label = savedName ? `${savedName} (inactive)` : `Inactive ${kind}`
  return { id: selectedId, label }
}
