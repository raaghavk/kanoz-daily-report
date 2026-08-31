import { describe, it, expect } from 'vitest'
import { buildTallyEnvelope, mapPurchaseToVoucher, escapeXml } from '../tallyXml'

describe('tallyXml', () => {
  it('escapes XML entities', () => {
    expect(escapeXml('A & B <C>')).toBe('A &amp; B &lt;C&gt;')
  })

  it('maps a purchase to a Purchase voucher using supplier ledger', () => {
    const v = mapPurchaseToVoucher(
      { id: '1', date: '2026-08-01', total_amount: 1100, transport_expense: 100, quantity_kg: 2000, supplier_name: 'Ram Singh', raw_material_type: 'Bhusa' },
      { purchase_ledger: 'Purchase Accounts' },
      'Ram Singh',
    )
    expect(v.voucher_type).toBe('Purchase')
    expect(v.amount).toBe(1000)
    expect(v.party_ledger).toBe('Ram Singh')
  })

  it('wraps vouchers in a Tally import envelope', () => {
    const xml = buildTallyEnvelope([
      { voucher_type: 'Purchase', voucher_date: '2026-08-01', party_ledger: 'Ram', account_ledger: 'Purchase Accounts', amount: 500, narration: 'test', status: 'pending' },
    ], 'Kanoz Pellets')
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>')
    expect(xml).toContain('<SVCURRENTCOMPANY>Kanoz Pellets</SVCURRENTCOMPANY>')
    expect(xml).toContain('VOUCHERTYPENAME>Purchase')
  })
})
