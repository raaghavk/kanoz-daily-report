import { describe, it, expect } from 'vitest'
import { TALLY_SHEET_HEADERS, voucherToSheetRow, mergeSheetRows } from '../tallySheets'

describe('tallySheets', () => {
  it('maps a voucher to a sheet row in stable column order', () => {
    const row = voucherToSheetRow({
      id: 'v1',
      voucher_date: '2026-08-15',
      voucher_type: 'Purchase',
      party_ledger: 'ABC Traders',
      account_ledger: 'Purchase Accounts',
      amount: 12500.5,
      narration: 'RM purchase',
      source_table: 'raw_material_purchases',
      source_id: 'p1',
      status: 'pending',
    }, { syncedAt: '2026-08-31T10:00:00Z', batchId: 'b1', company: 'Kanoz', plantName: 'Prayagraj' })

    expect(row).toHaveLength(TALLY_SHEET_HEADERS.length)
    expect(row[1]).toBe('b1')
    expect(row[4]).toBe('Purchase')
    expect(row[7]).toBe(12500.5)
    expect(row[11]).toBe('synced')
  })

  it('replaces prior rows for the same batch when merging', () => {
    const existing = [
      TALLY_SHEET_HEADERS,
      ['t1', 'old-batch', 'v0', '2026-08-01', 'Sales', 'C', 'Sales', 100, '', 'vehicle_dispatches', 'd0', 'synced', 'K', 'P'],
      ['t1', 'b1', 'v-old', '2026-08-10', 'Purchase', 'S', 'Purchase', 50, '', 'raw_material_purchases', 'p0', 'synced', 'K', 'P'],
    ]
    const next = [
      voucherToSheetRow({
        id: 'v-new', voucher_date: '2026-08-12', voucher_type: 'Purchase',
        party_ledger: 'S', account_ledger: 'Purchase Accounts', amount: 99,
        source_table: 'raw_material_purchases', source_id: 'p1', status: 'pending',
      }, { batchId: 'b1' }),
    ]
    const merged = mergeSheetRows(existing, 'b1', next)
    expect(merged[0]).toEqual(TALLY_SHEET_HEADERS)
    expect(merged).toHaveLength(3) // header + old-batch + new b1
    expect(merged[1][1]).toBe('old-batch')
    expect(merged[2][2]).toBe('v-new')
  })
})
