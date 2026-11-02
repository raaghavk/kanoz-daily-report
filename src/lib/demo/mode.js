/** Demo login used on the scrubbed prospect tour. Fictional Indian SME only. */
export const DEMO_EMAIL = 'demo@shree-biopellets.example'
export const DEMO_ADMIN_NAME = 'Rohan Sharma'
export const DEMO_APP_NAME = 'Demo Bio Pellets'
export const DEMO_ORG_NAME = 'Shree Demo Bio Pellets Pvt Ltd'
export const DEMO_PLANT_NAME = 'Riverside Demo Plant — Gorakhpur'

/**
 * Fictional attendance geofence only — NOT a real plant.
 * Offset from (0,0) so it is obviously sample GPS and never a live site.
 * Home weather is disabled in demo so these coords are not sent to Open-Meteo.
 */
export const DEMO_GEOFENCE_LAT = 0.0123
export const DEMO_GEOFENCE_LNG = 0.0456

/**
 * Prospect-tour mode. This branch is DEMO ONLY and must never talk to a live backend.
 *
 * True when:
 * - VITE_DEMO_MODE is true/1/yes (documented local run: VITE_DEMO_MODE=true npm run dev)
 * - VITE_DEMO_MODE is unset (this branch defaults ON so Vercel previews with inherited
 *   host env still never call a live database)
 * - Supabase URL/key are missing, empty, or still the .env.example placeholders
 *
 * The only way to turn it off is VITE_DEMO_MODE=false *and* a non-placeholder Supabase
 * env — do not do that on this branch.
 */
export function isDemoMode() {
  const flag = readDemoFlag()
  if (flag === true) return true
  if (flag === false) return !hasUsableSupabaseEnv()
  if (!hasUsableSupabaseEnv()) return true
  return true
}

export function readDemoFlag() {
  const raw = import.meta.env?.VITE_DEMO_MODE
  const flag = String(raw ?? '').trim().toLowerCase()
  if (flag === 'true' || flag === '1' || flag === 'yes') return true
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return null
}

export function hasUsableSupabaseEnv() {
  const url = String(import.meta.env?.VITE_SUPABASE_URL || '').trim()
  const key = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !key) return false
  if (/your-project|placeholder|example\.supabase/i.test(url)) return false
  if (/your-anon-key-here|placeholder/i.test(key)) return false
  return true
}
