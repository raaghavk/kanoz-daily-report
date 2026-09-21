import { describe, it, expect } from 'vitest'
import { purchasePushPath, dispatchPushPath } from '../purchaseDispatchPush'

describe('purchasePushPath', () => {
  it('opens the purchase detail when id is present', () => {
    expect(purchasePushPath('abc-123')).toBe('/purchase/abc-123')
  })

  it('falls back to the purchase list without an id', () => {
    expect(purchasePushPath(null)).toBe('/purchase')
    expect(purchasePushPath(undefined)).toBe('/purchase')
    expect(purchasePushPath('')).toBe('/purchase')
  })
})

describe('dispatchPushPath', () => {
  it('opens the dispatch detail when id is present', () => {
    expect(dispatchPushPath('disp-9')).toBe('/dispatch/disp-9')
  })

  it('falls back to the dispatch list without an id', () => {
    expect(dispatchPushPath(null)).toBe('/dispatch')
    expect(dispatchPushPath(undefined)).toBe('/dispatch')
    expect(dispatchPushPath('')).toBe('/dispatch')
  })
})
