import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = 'src/pages/shift/ShiftWizard.jsx'

describe('duplicate shift-report save recovery', () => {
  const src = readFileSync(resolve(SRC), 'utf8')
  const recovery = src.split("err?.code === '23505'")[1]?.split('showToast(err.message')[0] || ''

  it('looks up the existing live report after a unique-violation insert', () => {
    expect(recovery).toMatch(/from\('shift_reports'\)/)
    expect(recovery).toMatch(/maybeSingle\(\)/)
    expect(recovery).toMatch(/navigate\(`\/shift\/edit\/\$\{existing\.id\}`\)/)
  })

  it('filters is_deleted so a soft-deleted sibling does not break maybeSingle', () => {
    expect(recovery).toMatch(/\.eq\('is_deleted',\s*false\)/)
  })

  it('does not swallow a lookup error as “no existing report”', () => {
    expect(recovery).toMatch(/if \(existingErr\) throw existingErr/)
  })
})
