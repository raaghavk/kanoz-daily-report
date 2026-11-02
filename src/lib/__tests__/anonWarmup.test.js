import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('main.jsx pre-login supabase warm-up', () => {
  const src = readFileSync(resolve('src/main.jsx'), 'utf8')

  it('does not SELECT plants (or any table) as anon on every page load', () => {
    expect(src).not.toMatch(/from\(\s*['"]plants['"]\s*\)/)
    expect(src).not.toMatch(/supabase\.from\(/)
  })

  it('warms the proxy via auth, which still works without a session', () => {
    expect(src).toMatch(/supabase\.auth\.getSession\(\)/)
  })
})
