import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('vercel.json host redirect', () => {
  const cfg = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))

  it('redirects only kanoz-daily-report.vercel.app to https://app.kanoz.in', () => {
    expect(Array.isArray(cfg.redirects)).toBe(true)
    expect(cfg.redirects.length).toBeGreaterThan(0)
    for (const rule of cfg.redirects) {
      const hosts = (rule.has || []).filter((h) => h.type === 'host').map((h) => h.value)
      expect(hosts).toEqual(['kanoz-daily-report.vercel.app'])
      expect(rule.destination).toMatch(/^https:\/\/app\.kanoz\.in\//)
    }
  })

  it('does not attach a host condition for app.kanoz.in (no redirect loop)', () => {
    const blob = JSON.stringify(cfg.redirects)
    expect(blob).not.toMatch(/"value":"app\.kanoz\.in"/)
  })

  it('keeps the /supabase proxy rewrite on the canonical host', () => {
    expect(cfg.rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/supabase/:path*',
          destination: 'https://coguzmhpfmjkxmuasuoj.supabase.co/:path*',
        }),
      ]),
    )
  })
})
