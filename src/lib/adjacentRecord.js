/**
 * Map ordered sibling ids to older/newer neighbors and a 1-based position.
 * @param {string[]} ids - ids already sorted by the caller's orderBy
 * @param {string} currentId
 * @param {boolean} ascending - true = oldest→newest; false = newest→oldest
 */
export function adjacentFromIds(ids, currentId, ascending = false) {
  const idx = ids.indexOf(currentId)
  if (idx < 0) {
    return { newerId: null, olderId: null, position: null, total: ids.length }
  }
  if (ascending) {
    // Chronological: index 0 is oldest (position 1)
    return {
      olderId: idx > 0 ? ids[idx - 1] : null,
      newerId: idx < ids.length - 1 ? ids[idx + 1] : null,
      position: idx + 1,
      total: ids.length,
    }
  }
  // Newest-first: index 0 is newest (position 1)
  return {
    newerId: idx > 0 ? ids[idx - 1] : null,
    olderId: idx < ids.length - 1 ? ids[idx + 1] : null,
    position: idx + 1,
    total: ids.length,
  }
}
