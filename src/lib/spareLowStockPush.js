/**
 * Deep-link for the spare_part_low_stock push. In-app low-stock alerts already
 * go to /spare-parts/parts/:id; the push used to open the catalogue list.
 */
export function spareLowStockPushPath(partId) {
  return partId ? `/spare-parts/parts/${partId}` : '/spare-parts/parts'
}
