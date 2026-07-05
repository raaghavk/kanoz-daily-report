// Pellet identity derived from a mix's raw-material recipe.
// A pellet IS its mix: name comes from the dominant ingredient, GCV is the
// kg-weighted average of ingredient GCVs, and grade comes from the plant's
// single GCV threshold (>= threshold -> 'High GCV', else 'Low GCV').

const DEFAULT_THRESHOLD = 3200

// Grade for a GCV value against a plant threshold. Returns null when GCV is unknown.
export function gradeForGcv(gcv, threshold = DEFAULT_THRESHOLD) {
  const g = parseFloat(gcv)
  if (gcv == null || Number.isNaN(g)) return null
  const t = parseFloat(threshold)
  return g >= (Number.isNaN(t) ? DEFAULT_THRESHOLD : t) ? 'High GCV' : 'Low GCV'
}

// Derive { name, gcv, grade } for a mix.
// ingredients: [{ raw_material_type_id, quantity_kg, name? }]
// rawMaterials: [{ id, name, gcv_kcal_kg }]
export function deriveMixPellet(ingredients, rawMaterials, threshold = DEFAULT_THRESHOLD) {
  const rms = Array.isArray(rawMaterials) ? rawMaterials : []
  const valid = (Array.isArray(ingredients) ? ingredients : [])
    .map(ing => ({ ...ing, _qty: parseFloat(ing?.quantity_kg) || 0 }))
    .filter(ing => ing.raw_material_type_id && ing._qty > 0)

  if (valid.length === 0) return { name: null, gcv: null, grade: null }

  // Dominant ingredient by weight (first wins on ties)
  const dominant = valid.reduce((a, b) => (b._qty > a._qty ? b : a))
  const dominantRM = rms.find(r => r.id === dominant.raw_material_type_id)
  const dominantName = dominantRM?.name || dominant.name || 'Mixed'
  const name = `${dominantName} Pellet`

  // Weighted-average GCV over ingredients whose RM has a GCV configured
  let weightedSum = 0
  let weightKg = 0
  valid.forEach(ing => {
    const rm = rms.find(r => r.id === ing.raw_material_type_id)
    if (rm && rm.gcv_kcal_kg != null) {
      const g = parseFloat(rm.gcv_kcal_kg)
      if (!Number.isNaN(g)) {
        weightedSum += g * ing._qty
        weightKg += ing._qty
      }
    }
  })
  const gcv = weightKg > 0 ? weightedSum / weightKg : null

  return { name, gcv, grade: gradeForGcv(gcv, threshold) }
}

// Weighted-average a list of [{ name, gcv, kg }] entries sharing the same name.
// Returns { name, gcv, kg } — gcv is kg-weighted over entries that have a GCV
// (null when none do), kg is the total weight.
export function averagePellets(list) {
  const entries = (Array.isArray(list) ? list : []).filter(e => e && e.name)
  if (entries.length === 0) return null

  let kgTotal = 0
  let weightedSum = 0
  let weightKg = 0
  const knownGcvs = []
  entries.forEach(e => {
    const kg = parseFloat(e.kg) || 0
    kgTotal += kg
    const g = parseFloat(e.gcv)
    if (e.gcv != null && !Number.isNaN(g)) {
      knownGcvs.push(g)
      weightedSum += g * kg
      weightKg += kg
    }
  })

  let gcv = null
  if (knownGcvs.length > 0) {
    gcv = weightKg > 0
      ? weightedSum / weightKg
      // All weights zero — fall back to a simple average so GCV isn't lost
      : knownGcvs.reduce((s, v) => s + v, 0) / knownGcvs.length
  }

  return { name: entries[0].name, gcv, kg: kgTotal }
}

// Resolve (or create) the pellet_types row for a derived pellet.
// Looks up by plant_id + name (case-insensitive). Updates gcv_kcal_kg/grade if
// changed, inserts { plant_id, name, gcv_kcal_kg, grade, is_active: true } when
// missing. Returns the row, or null on any error (callers fall back gracefully).
export async function ensurePelletType(supabase, plantId, { name, gcv, grade }) {
  try {
    if (!supabase || !plantId || !name) return null
    const gcvValue = gcv != null && !Number.isNaN(parseFloat(gcv)) ? parseFloat(gcv) : null
    const gradeValue = grade || null

    // Escape ilike wildcards in the name for an exact case-insensitive match
    const pattern = name.replace(/([%_\\])/g, '\\$1')
    const { data: existing, error: findErr } = await supabase
      .from('pellet_types')
      .select('*')
      .eq('plant_id', plantId)
      .ilike('name', pattern)
      .limit(1)
      .maybeSingle()
    if (findErr) return null

    if (existing) {
      const existingGcv = existing.gcv_kcal_kg != null ? parseFloat(existing.gcv_kcal_kg) : null
      const changed = existingGcv !== gcvValue || (existing.grade || null) !== gradeValue
      if (!changed) return existing
      const { data: updated, error: updErr } = await supabase
        .from('pellet_types')
        .update({ gcv_kcal_kg: gcvValue, grade: gradeValue })
        .eq('id', existing.id)
        .select()
        .single()
      return updErr ? existing : updated
    }

    const { data: inserted, error: insErr } = await supabase
      .from('pellet_types')
      .insert({ plant_id: plantId, name, gcv_kcal_kg: gcvValue, grade: gradeValue, is_active: true })
      .select()
      .single()
    return insErr ? null : inserted
  } catch (err) {
    console.error('ensurePelletType error:', err)
    return null
  }
}
