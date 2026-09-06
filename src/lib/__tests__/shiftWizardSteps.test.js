import { describe, it, expect } from 'vitest'
import { SHIFT_STEP, SHIFT_STEP_COUNT, SHIFT_STEP_TITLES } from '../shiftWizardSteps'

describe('shift wizard step map', () => {
  it('has 11 titled steps matching the current wizard', () => {
    expect(SHIFT_STEP_COUNT).toBe(11)
    expect(SHIFT_STEP_TITLES).toHaveLength(11)
    expect(SHIFT_STEP.PRODUCTION).toBe(5)
    expect(SHIFT_STEP.DISPATCH).toBe(8)
    expect(SHIFT_STEP.PELLET).toBe(9)
    expect(SHIFT_STEP.SUBMIT).toBe(11)
  })
})
