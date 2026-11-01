/**
 * Merge extract-receipt `diesel_receipt` OCR onto a diesel_stock purchases row.
 *
 * Auto-scan fires from PhotoUpload onChange right after upload, before React
 * has re-rendered with receipt_url. Spreading the stale diesel_stock snapshot
 * used to wipe the photo (same race as RM katta-parchi scan).
 *
 * Tank closing is opening + purchased - issued to equipment (`added`), not
 * equipment consumption (`used`).
 */
export function applyDieselReceiptOcr(stock, idx, ocr, receiptUrl, equipment = []) {
  const purchases = [...(stock?.purchases || [])]
  while (purchases.length <= idx) {
    purchases.push({ litres: '', cost_per_litre: '', purchase_time: '', receipt_url: null })
  }
  const row = { ...purchases[idx] }
  if (ocr?.litres != null && ocr.litres !== '') row.litres = ocr.litres
  if (ocr?.cost_per_litre != null && ocr.cost_per_litre !== '') row.cost_per_litre = ocr.cost_per_litre
  if (ocr?.time) row.purchase_time = ocr.time
  if (receiptUrl && !row.receipt_url) row.receipt_url = receiptUrl
  purchases[idx] = row

  const purchased = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
  const issued = (equipment || []).reduce((sum, eq) => sum + (parseFloat(eq.added) || 0), 0)
  const opening = parseFloat(stock?.opening) || 0
  return { ...stock, purchases, purchased, closing: opening + purchased - issued }
}
