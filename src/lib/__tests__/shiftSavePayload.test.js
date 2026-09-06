import { describe, it, expect } from 'vitest'
import { buildShiftChildrenPayload } from '../shiftSavePayload'

describe('buildShiftChildrenPayload issues', () => {
  it('includes the selected machine_id', () => {
    const payload = buildShiftChildrenPayload({
      machines: [],
      production: [],
      mixes: [],
      rawMaterials: [],
      processing: [],
      diesel: [],
      pelletStock: [],
      issues: [{
        type: 'Machine',
        description: 'Belt snapped',
        severity: 'high',
        photo_url: null,
        machine_id: '11111111-1111-1111-1111-111111111111',
      }],
      diesel_stock: {},
    }, { id: 'p1', org_id: 'o1' })

    expect(payload.issues[0].machine_id).toBe('11111111-1111-1111-1111-111111111111')
  })
})
