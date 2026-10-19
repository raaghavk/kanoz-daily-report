/** Display helpers for Stock & Recipes. Never clamp a negative balance to zero. */

export function normalizeStockName(n) {
  return (n || '').toString().trim().toLowerCase()
}

export function isNegativeStock(value) {
  return Number(value) < -0.0005
}

/**
 * Notes for a pellet closing figure from the latest live shift report.
 * `mixLabels` are derived_pellet_name (or mix name) from Recipes / Mixes.
 * Admin pellet_types.recipe is optional extra context.
 */
export function pelletStockNotes(pellet, mixLabels = []) {
  const notes = []
  if (!isNegativeStock(pellet?.mt)) return notes

  notes.push('Negative stock — recorded closing is below zero (oversold or missing production). Figure is not clamped.')

  const nameKey = normalizeStockName(pellet?.name)
  const hasMix = (mixLabels || []).some(l => normalizeStockName(l) === nameKey)
  const hasRecipe = Array.isArray(pellet?.recipe) && pellet.recipe.length > 0
  if (!hasMix && !hasRecipe) {
    notes.push('No mix/recipe on file — this type never received mix production credit.')
  } else if (!hasMix) {
    notes.push('No shift mix named after this pellet — mix production is not credited to this type.')
  }
  return notes
}

export function rawMaterialStockNotes(row) {
  if (!isNegativeStock(row?.kg)) return []
  return ['Negative stock — opening + purchases + production − usage is below zero. Figure is not clamped.']
}
