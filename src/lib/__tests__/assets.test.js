import { describe, it, expect } from 'vitest'
import { cacheForEvent, deriveCacheFromLatest } from '../assets'

describe('cacheForEvent', () => {
  it('treats in-house repaired as a no-op (no status/location change)', () => {
    expect(cacheForEvent('repaired')).toEqual({})
  })
})

describe('deriveCacheFromLatest', () => {
  it('defaults empty history to in store', () => {
    expect(deriveCacheFromLatest([])).toEqual({
      status: 'in_store',
      current_location: 'Main Store',
      current_machine_id: null,
    })
  })

  it('keeps running + machine when the latest event is in-house repaired', () => {
    const cache = deriveCacheFromLatest([
      { event_type: 'purchased', to_location: 'Main Store' },
      { event_type: 'installed', to_location: 'Hammer Mill', machine_id: 'm1' },
      { event_type: 'repaired', work_type: 'Rewinding' },
    ])
    expect(cache).toEqual({
      status: 'running',
      current_location: 'Hammer Mill',
      current_machine_id: 'm1',
    })
  })

  it('walks past multiple in-house repairs', () => {
    const cache = deriveCacheFromLatest([
      { event_type: 'installed', to_location: 'Log Eater', machine_id: 'm2' },
      { event_type: 'repaired' },
      { event_type: 'repaired' },
    ])
    expect(cache).toEqual({
      status: 'running',
      current_location: 'Log Eater',
      current_machine_id: 'm2',
    })
  })

  it('still parks as in store when repaired follows removed', () => {
    const cache = deriveCacheFromLatest([
      { event_type: 'installed', to_location: 'Mill', machine_id: 'm1' },
      { event_type: 'removed', from_location: 'Mill' },
      { event_type: 'repaired' },
    ])
    expect(cache.status).toBe('in_store')
    expect(cache.current_machine_id).toBe(null)
  })

  it('keeps at-repair when repaired follows sent_vendor', () => {
    const cache = deriveCacheFromLatest([
      { event_type: 'sent_vendor', to_location: 'Rewind Shop' },
      { event_type: 'repaired' },
    ])
    expect(cache).toEqual({
      status: 'in_repair',
      current_location: 'Rewind Shop',
      current_machine_id: null,
    })
  })

  it('still maps purchased / installed / scrapped from the last status-changing event', () => {
    expect(deriveCacheFromLatest([{ event_type: 'purchased', to_location: 'Main Store' }])).toEqual({
      status: 'in_store',
      current_location: 'Main Store',
      current_machine_id: null,
    })
    expect(deriveCacheFromLatest([{ event_type: 'installed', to_location: 'Die', machine_id: 'm3' }])).toEqual({
      status: 'running',
      current_location: 'Die',
      current_machine_id: 'm3',
    })
    expect(deriveCacheFromLatest([{ event_type: 'scrapped', to_location: 'Scrap Yard' }])).toEqual({
      status: 'scrapped',
      current_location: 'Scrap Yard',
      current_machine_id: null,
    })
  })
})
