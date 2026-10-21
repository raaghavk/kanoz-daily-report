import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCRIPT = 'google-apps-script/KanozSync.gs'

describe('KanozSync.gs after anon REST lock-down', () => {
  const src = readFileSync(resolve(SCRIPT), 'utf8')

  it('pulls tables through get-sheet-data?mode=rest, not anon /rest/v1', () => {
    expect(src).toMatch(/functions\/v1\/get-sheet-data\?mode=rest&table=/)
    expect(src).toMatch(/x-sheet-sync-secret/)
    expect(src).toMatch(/PropertiesService\.getScriptProperties\(\)\.getProperty\('SHEET_SYNC_SECRET'\)/)
    expect(src).not.toMatch(/\/rest\/v1\//)
    expect(src).not.toMatch(/Authorization['"]?\s*:\s*['"]Bearer/)
  })

  it('selects dispatch invoice_no, the real column', () => {
    expect(src).toMatch(/invoice_no/)
    expect(src).not.toMatch(/invoice_number/)
  })

  it('tells the installer to set SHEET_SYNC_SECRET in script properties', () => {
    expect(src).toMatch(/Script properties/)
    expect(src).toMatch(/SHEET_SYNC_SECRET/)
  })
})
