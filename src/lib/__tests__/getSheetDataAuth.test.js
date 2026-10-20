import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FN = 'supabase/functions/get-sheet-data/index.ts'
const CFG = 'supabase/functions/get-sheet-data/config.toml'
const README = 'supabase/functions/get-sheet-data/README.md'

describe('get-sheet-data auth', () => {
  const src = readFileSync(resolve(FN), 'utf8')
  const cfg = readFileSync(resolve(CFG), 'utf8')
  const readme = readFileSync(resolve(README), 'utf8')

  it('keeps verify_jwt false so Apps Script can send a secret instead of a user JWT', () => {
    expect(cfg).toMatch(/verify_jwt\s*=\s*false/)
  })

  it('refuses to run until SHEET_SYNC_SECRET is configured', () => {
    expect(src).toMatch(/SHEET_SYNC_SECRET/)
    expect(src).toMatch(/is not configured/)
  })

  it('accepts x-sheet-sync-secret (or Bearer secret) and not the anon key alone', () => {
    expect(src).toMatch(/x-sheet-sync-secret/)
    expect(src).toMatch(/secretHeaderMatches/)
    expect(src).toMatch(/requireCaller/)
  })

  it('does not construct a service-role client until the secret matches', () => {
    const secretIdx = src.indexOf('secretHeaderMatches(providedSheetSecret(req), expected)')
    const serviceIdx = src.indexOf("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")
    expect(secretIdx).toBeGreaterThan(0)
    expect(serviceIdx).toBeGreaterThan(secretIdx)
  })

  it('keeps the live CSV sections the Sheet already calls', () => {
    for (const section of ['kpis', 'production', 'raw_material', 'dispatch', 'raw_stock', 'pellet_stock']) {
      expect(src).toContain(`section === '${section}'`)
    }
  })

  it('adds a secret-gated GET-only PostgREST proxy for mode=rest', () => {
    expect(src).toMatch(/mode['"]?\) === 'rest'/)
    expect(src).toMatch(/REST proxy is GET only/)
    expect(src).toMatch(/table is not allowed/)
    expect(src).toMatch(/Content-Range/)
    const restIdx = src.indexOf("searchParams.get('mode') === 'rest'")
    expect(restIdx).toBeGreaterThan(0)
    expect(src.slice(restIdx, restIdx + 900)).not.toMatch(/requireCaller/)
    expect(src).toMatch(/proxyRest\(/)
  })

  it('documents the Daily Report Import REST URL, headers, and cnt_* wipe', () => {
    expect(readme).toMatch(/mode=rest&table=/)
    expect(readme).toMatch(/needsSync/)
    expect(readme).toMatch(/supabaseFetch/)
    expect(readme).toMatch(/x-sheet-sync-secret/)
    expect(readme).toMatch(/PropertiesService\.getScriptProperties\(\)\.getProperty\('SHEET_SYNC_SECRET'\)/)
    expect(readme).toMatch(/Do \*\*not\*\* send `Authorization: Bearer <anon>`/)
    expect(readme).toMatch(/cnt_\*/)
    expect(readme).toMatch(/20261020_drop_anon_read_policies/)
    expect(readme).toMatch(/UrlFetchApp\.fetch/)
  })
})
