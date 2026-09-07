import { describe, it, expect } from 'vitest'
import { DELETE_TABLE_MAP, deactivateFields, alreadyDeletedLabel } from '../deleteRequests'

describe('DELETE_TABLE_MAP', () => {
  it('maps spare_part to spare_parts (not spare_part_items)', () => {
    expect(DELETE_TABLE_MAP.spare_part).toBe('spare_parts')
  })

  it('maps asset to assets', () => {
    expect(DELETE_TABLE_MAP.asset).toBe('assets')
  })
})

describe('deactivateFields', () => {
  it('soft-deletes purchases with is_deleted', () => {
    expect(deactivateFields('purchase', { employeeId: 'e1', deletedAt: '2026-09-07T00:00:00Z' })).toEqual({
      is_deleted: true,
      deleted_by: 'e1',
      deleted_at: '2026-09-07T00:00:00Z',
    })
  })

  it('deactivates assets without writing is_deleted', () => {
    const patch = deactivateFields('asset', { employeeId: 'e1', deletedAt: 't' })
    expect(patch.is_deleted).toBeUndefined()
    expect(patch).toEqual({ is_active: false, deleted_by: 'e1', deleted_at: 't' })
  })

  it('deactivates spare parts with is_active only', () => {
    const patch = deactivateFields('spare_part', { employeeId: 'e1', deletedAt: 't' })
    expect(patch).toEqual({ is_active: false })
  })
})

describe('alreadyDeletedLabel', () => {
  it('flags is_deleted rows for transactional tables', () => {
    expect(alreadyDeletedLabel('purchase', { is_deleted: true })).toBe('Already deleted')
    expect(alreadyDeletedLabel('dispatch', { is_deleted: false })).toBeNull()
  })

  it('flags inactive catalogue rows', () => {
    expect(alreadyDeletedLabel('spare_part', { is_active: false })).toBe('Already deleted')
    expect(alreadyDeletedLabel('asset', { is_active: true, deleted_at: 't' })).toBe('Already deleted')
    expect(alreadyDeletedLabel('asset', { is_active: true })).toBeNull()
  })
})
