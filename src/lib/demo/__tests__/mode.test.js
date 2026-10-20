import { describe, it, expect } from 'vitest'
import { isDemoMode, hasUsableSupabaseEnv, DEMO_EMAIL, DEMO_PLANT_NAME, DEMO_ORG_NAME, DEMO_ADMIN_NAME, DEMO_APP_NAME, DEMO_GEOFENCE_LAT, DEMO_GEOFENCE_LNG } from '../mode'

describe('demo mode', () => {
  it('exposes the fictional Indian demo login', () => {
    expect(DEMO_EMAIL).toBe('demo@shree-biopellets.example')
    expect(DEMO_ADMIN_NAME).toBe('Rohan Sharma')
    expect(DEMO_APP_NAME).toBe('Demo Bio Pellets')
  })

  it('brands the fictional Gorakhpur plant, not Acme/US names', () => {
    expect(DEMO_ORG_NAME).toMatch(/Shree Demo Bio Pellets/i)
    expect(DEMO_PLANT_NAME).toMatch(/Riverside Demo Plant/i)
    expect(DEMO_PLANT_NAME).toMatch(/Gorakhpur/i)
    expect(DEMO_ORG_NAME).not.toMatch(/Acme/i)
    expect(DEMO_PLANT_NAME).not.toMatch(/Acme/i)
    expect(DEMO_EMAIL).not.toMatch(/acme/i)
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
