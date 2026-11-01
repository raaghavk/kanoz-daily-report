export function activePlantStorageKey(userId) {
  return `kanoz:activePlantId:${userId}`
}

export function readSavedPlantId(userId) {
  if (!userId) return null
  try {
    return localStorage.getItem(activePlantStorageKey(userId))
  } catch {
    return null
  }
}

export function writeSavedPlantId(userId, plantId) {
  if (!userId || !plantId) return
  try {
    localStorage.setItem(activePlantStorageKey(userId), plantId)
  } catch { /* private mode / storage blocked */ }
}
