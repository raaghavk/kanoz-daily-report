// spare_parts_purchases.total_amount is qty * rate (ex-GST).
// grand_total is that subtotal plus GST — the amount actually paid.
export function sparePurchaseTotal(row) {
  if (!row) return 0
  return Number(row.grand_total) || Number(row.total_amount) || 0
}

export function sumSparePurchaseTotals(rows) {
  return (rows || []).reduce((sum, row) => sum + sparePurchaseTotal(row), 0)
}
