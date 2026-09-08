/**
 * Map extract-receipt `katta_parchi` OCR onto DispatchForm fields.
 *
 * Weighbridge slips carry a slip/parchi serial, not the plant invoice number.
 * Invoice is a separate required field the operator types (live plant invoices
 * are short sequential numbers; serials are 6-digit parchi numbers).
 */
export function kattaParchiToDispatchUpdates(ocr) {
  const updates = {}
  if (!ocr || typeof ocr !== 'object') return updates
  if (ocr.vehicle_number) updates.truck_number = ocr.vehicle_number
  if (ocr.serial_no != null && String(ocr.serial_no).trim() !== '') {
    updates.serial_no = String(ocr.serial_no)
  }
  if (ocr.date) {
    const parsed = new Date(ocr.date)
    if (!Number.isNaN(parsed.getTime())) {
      updates.dispatch_date = ocr.date
      updates.loading_date = ocr.date
    }
  }
  if (ocr.time) {
    updates.dispatch_time = ocr.time
    updates.loading_time = ocr.time
  }
  return updates
}
