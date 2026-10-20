import { describe, it, expect } from 'vitest'
import {
  REST_PROXY_TABLES,
  isAllowedRestProxyTable,
  restProxyForwardSearchFromRaw,
  restProxyUpstreamUrl,
  restProxyForwardHeaders,
} from '../../../supabase/functions/get-sheet-data/restProxy.js'

describe('REST proxy allowlist', () => {
  it('allows exactly the five Daily Report Import tables', () => {
    expect([...REST_PROXY_TABLES].sort()).toEqual([
      'raw_material_purchases',
      'shift_reports',
      'suppliers',
      'transporters',
      'vehicle_dispatches',
    ].sort())
    expect(REST_PROXY_TABLES).toHaveLength(5)
  })

  it('rejects any other table name', () => {
    expect(isAllowedRestProxyTable('customers')).toBe(false)
    expect(isAllowedRestProxyTable('employees')).toBe(false)
    expect(isAllowedRestProxyTable('dispatch_pellets')).toBe(false)
    expect(isAllowedRestProxyTable('')).toBe(false)
    expect(isAllowedRestProxyTable('raw_material_purchases;drop')).toBe(false)
  })
})

describe('REST proxy query forward', () => {
  const qs = [
    'mode=rest',
    'table=vehicle_dispatches',
    'select=id,date,customers(name),dispatch_pellets(pellet_type_name,quantity_mt),transporters!transporter_id(name)',
    'plant_id=eq.b0000000-0000-0000-0000-000000000001',
    'is_deleted=eq.false',
    'order=date.desc',
  ].join('&')

  it('strips mode and table and keeps PostgREST filters, order, and embeds', () => {
    const forwarded = restProxyForwardSearchFromRaw('?' + qs)
    expect(forwarded).not.toMatch(/(^|&)mode=/)
    expect(forwarded).not.toMatch(/(^|&)table=/)
    expect(forwarded).toContain('select=id,date,customers(name),dispatch_pellets(pellet_type_name,quantity_mt),transporters!transporter_id(name)')
    expect(forwarded).toContain('plant_id=eq.b0000000-0000-0000-0000-000000000001')
    expect(forwarded).toContain('is_deleted=eq.false')
    expect(forwarded).toContain('order=date.desc')
  })

  it('builds the PostgREST URL only for allowlisted tables', () => {
    const url = restProxyUpstreamUrl('https://coguzmhpfmjkxmuasuoj.supabase.co/', 'shift_reports', qs)
    expect(url).toBe(
      'https://coguzmhpfmjkxmuasuoj.supabase.co/rest/v1/shift_reports?'
      + restProxyForwardSearchFromRaw(qs),
    )
    expect(restProxyUpstreamUrl('https://example.supabase.co', 'customers', qs)).toBeNull()
  })

  it('forwards Prefer and Range and ignores other headers', () => {
    const headers = restProxyForwardHeaders((name) => {
      const map = { prefer: 'count=exact', range: '0-0', authorization: 'Bearer anon' }
      return map[name.toLowerCase()] || null
    })
    expect(headers).toEqual({ Prefer: 'count=exact', Range: '0-0' })
  })
})
