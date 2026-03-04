export function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLength)
}

export function sanitizeNumber(input, { min = 0, max = Infinity } = {}) {
  const num = parseFloat(input)
  if (isNaN(num)) return 0
  return Math.min(Math.max(num, min), max)
}
