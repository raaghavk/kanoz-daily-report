/** Prefer live linked-dispatch totals, including zero, when that query succeeded. */
export function effectiveDispatchMt(liveMt, savedMt, liveOk) {
  if (liveOk) return Number(liveMt) || 0
  return Number(savedMt) || 0
}

export function formatAdjustmentMt(value) {
  const n = parseFloat(value) || 0
  if (n === 0) return '—'
  return (n > 0 ? '+' : '') + n.toFixed(1)
}
