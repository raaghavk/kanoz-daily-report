/**
 * Sheet row helpers for Tally voucher sync (client-side tests / preview).
 * The edge function writes the same column order.
 */

export const TALLY_SHEET_HEADERS = [
  'Synced At',
  'Batch Id',
  'Voucher Id',
  'Date',
  'Type',
  'Party Ledger',
  'Account Ledger',
  'Amount',
  'Narration',
  'Source Table',
  'Source Id',
  'Status',
  'Company',
  'Plant',
]

export function voucherToSheetRow(v, meta = {}) {
  return [
    meta.syncedAt || '',
    meta.batchId || '',
    v.id || '',
    String(v.voucher_date || '').slice(0, 10),
    v.voucher_type || '',
    v.party_ledger || '',
    v.account_ledger || '',
    Number(v.amount) || 0,
    v.narration || '',
    v.source_table || '',
    v.source_id || '',
    v.status === 'skipped' ? 'skipped' : 'synced',
    meta.company || '',
    meta.plantName || '',
  ]
}

/** Drop prior rows for the same batch, keep header + other batches. */
export function mergeSheetRows(existingRows, batchId, newDataRows, headers = TALLY_SHEET_HEADERS) {
  const hasHeader = existingRows?.[0]?.[0] === headers[0]
  const body = hasHeader ? existingRows.slice(1) : (existingRows || [])
  const kept = body.filter((row) => row[1] !== batchId)
  return [headers, ...kept, ...newDataRows]
}
