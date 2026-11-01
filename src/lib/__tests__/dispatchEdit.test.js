import { describe, it, expect } from 'vitest'
import {
  buildDispatchEditForm,
  applyCustomerToDispatchEdit,
  buildDispatchEditPayload,
} from '../dispatchEdit'

const dispatch = {
  truck_number: 'UP70MT6151',
  customer_id: 'c1',
  destination: 'Kanpur depot',
  driver_name: 'Ravi',
  driver_phone: '8858092006',
  transporter: 'Singh Transport',
  serial_no: '023253',
  invoice_no: 'INV-9',
  loading_date: '2026-10-18',
  loading_time: '09:15:00',
  dispatch_date: '2026-10-18',
  dispatch_time: '14:22:00',
  date: '2026-10-18',
  remarks: 'Gate 2',
}

describe('buildDispatchEditForm', () => {
  it('includes destination and slices times to HH:MM', () => {
    const form = buildDispatchEditForm(dispatch)
    expect(form.destination).toBe('Kanpur depot')
    expect(form.loading_time).toBe('09:15')
    expect(form.dispatch_time).toBe('14:22')
  })
})

describe('applyCustomerToDispatchEdit', () => {
  it('fills destination from the selected customer address', () => {
    const form = buildDispatchEditForm(dispatch)
    const next = applyCustomerToDispatchEdit(form, { id: 'c2', address: 'Lucknow yard' })
    expect(next.customer_id).toBe('c2')
    expect(next.destination).toBe('Lucknow yard')
  })

  it('leaves destination alone when the customer has no address', () => {
    const form = buildDispatchEditForm(dispatch)
    const next = applyCustomerToDispatchEdit(form, { id: 'c2' })
    expect(next.destination).toBe('Kanpur depot')
  })
})

describe('buildDispatchEditPayload', () => {
  it('writes destination on save', () => {
    const form = { ...buildDispatchEditForm(dispatch), destination: '  Unnao plant  ' }
    expect(buildDispatchEditPayload(form, dispatch).destination).toBe('Unnao plant')
  })
})
