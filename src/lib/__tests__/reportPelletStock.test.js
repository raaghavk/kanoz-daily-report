import { describe, it, expect } from 'vitest'
import { effectiveDispatchMt, formatAdjustmentMt } from '../reportPelletStock'

describe('effectiveDispatchMt', () => {
  it('uses live total including zero when live query succeeded', () => {
    expect(effectiveDispatchMt(0, 5.5, true)).toBe(0)
    expect(effectiveDispatchMt(3.2, 5.5, true)).toBe(3.2)
  })

  it('falls back to the saved snapshot if live dispatches failed to load', () => {
    expect(effectiveDispatchMt(0, 5.5, false)).toBe(5.5)
  })
})

describe('formatAdjustmentMt', () => {
  it('shows em dash for zero and signed values otherwise', () => {
    expect(formatAdjustmentMt(0)).toBe('—')
    expect(formatAdjustmentMt(1.5)).toBe('+1.5')
    expect(formatAdjustmentMt(-0.4)).toBe('-0.4')
  })
})
