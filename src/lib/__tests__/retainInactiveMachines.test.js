import { describe, it, expect } from 'vitest'
import { appendInactiveMachines } from '../retainInactiveMachines'
import { buildShiftChildrenPayload } from '../shiftSavePayload'

const activeHammer = {
  id: 'active-1',
  name: 'Hammer Mill',
  machine_type: 'Hammer Mill',
  did_not_run: false,
  production_hours: 6,
  total_hours: 6.5,
  from_time: '08:00',
  to_time: '14:30',
  breakdown_hrs: 0.5,
  remarks: 'ok',
}

const savedInactive = {
  machine_id: 'old-log-eater',
  did_not_run: false,
  hours_run: 8,
  total_hours: 8.5,
  from_time: '08:00',
  to_time: '16:30',
  breakdown_hours: 0.5,
  remarks: 'replaced next week',
  machines: { name: 'Log Eater 1', machine_type: 'Log Eater' },
}

describe('appendInactiveMachines', () => {
  it('keeps a deactivated machine so Update Report cannot drop its hours', () => {
    const machines = appendInactiveMachines([activeHammer], [
      {
        machine_id: 'active-1',
        hours_run: 6,
        total_hours: 6.5,
        from_time: '08:00',
        to_time: '14:30',
        breakdown_hours: 0.5,
        machines: { name: 'Hammer Mill' },
      },
      savedInactive,
    ])

    expect(machines.map(m => m.id)).toEqual(['active-1', 'old-log-eater'])
    const retained = machines.find(m => m.id === 'old-log-eater')
    expect(retained.name).toBe('Log Eater 1')
    expect(retained.production_hours).toBe(8)
    expect(retained.total_hours).toBe(8.5)
    expect(retained.from_time).toBe('08:00')
    expect(retained.to_time).toBe('16:30')
    expect(retained.remarks).toBe('replaced next week')
  })

  it('does not duplicate a machine that is still active', () => {
    const machines = appendInactiveMachines([activeHammer], [{
      machine_id: 'active-1',
      hours_run: 99,
      machines: { name: 'Should not replace' },
    }])
    expect(machines).toHaveLength(1)
    expect(machines[0].production_hours).toBe(6)
    expect(machines[0].name).toBe('Hammer Mill')
  })

  it('skips rows with no machine_id', () => {
    const machines = appendInactiveMachines([activeHammer], [{ hours_run: 3 }])
    expect(machines).toEqual([activeHammer])
  })
})

describe('inactive machine round-trip on save', () => {
  it('re-inserts the deactivated machine hours and production_mt', () => {
    const machines = appendInactiveMachines([activeHammer], [savedInactive])
    const payload = buildShiftChildrenPayload({
      machines,
      production: [
        { machine_id: 'active-1', quantity: 4.2, mix_usages: [] },
        { machine_id: 'old-log-eater', quantity: 3.1, mix_usages: [] },
      ],
      mixes: [],
      rawMaterials: [],
      processing: [],
      diesel: [],
      pelletStock: [],
      issues: [],
      diesel_stock: {},
    }, { id: 'p1', org_id: 'o1' })

    const byId = Object.fromEntries(payload.machine_production.map(r => [r.machine_id, r]))
    expect(byId['old-log-eater'].hours_run).toBe(8)
    expect(byId['old-log-eater'].total_hours).toBe(8.5)
    expect(byId['old-log-eater'].from_time).toBe('08:00')
    expect(byId['old-log-eater'].production_mt).toBe(3.1)
    expect(byId['active-1'].production_mt).toBe(4.2)
  })
})
