import { describe, it, expect, beforeEach } from 'vitest'
import { isDemoMode, hasUsableSupabaseEnv, DEMO_EMAIL } from '../mode'

describe('demo mode', () => {
  it('exposes the fictional demo login', () => {
    expect(DEMO_EMAIL).toBe('demo@acme-biomass.example')
  })

  it('treats missing/placeholder supabase env as not usable', () => {
    expect(hasUsableSupabaseEnv()).toBe(false)
  })

  it('is on when supabase env is missing (vitest has no live keys)', () => {
    expect(isDemoMode()).toBe(true)
  })
})
