import { describe, it, expect } from 'vitest'
import { isDemoMode, hasUsableSupabaseEnv, DEMO_EMAIL, DEMO_PLANT_NAME, DEMO_GEOFENCE_LAT, DEMO_GEOFENCE_LNG } from '../mode'

describe('demo mode', () => {
  it('exposes the fictional demo login', () => {
    expect(DEMO_EMAIL).toBe('demo@acme-biomass.example')
  })

  it('brands the fictional Demo Bio Pellets / Acme plant', () => {
    expect(DEMO_PLANT_NAME).toMatch(/Demo Bio Pellets/i)
    expect(DEMO_PLANT_NAME).toMatch(/Acme/i)
  })

  it('uses a clearly fake geofence, not a real plant', () => {
    expect(Math.abs(DEMO_GEOFENCE_LAT)).toBeLessThan(1)
    expect(Math.abs(DEMO_GEOFENCE_LNG)).toBeLessThan(1)
  })

  it('treats missing/placeholder supabase env as not usable', () => {
    expect(hasUsableSupabaseEnv()).toBe(false)
  })

  it('is on when supabase env is missing (vitest has no live keys)', () => {
    expect(isDemoMode()).toBe(true)
  })
})
