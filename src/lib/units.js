// Raw materials are STORED in kg (so money/generated columns stay exact) but
// shown to users in MT. These helpers convert at the display/input boundary.
// 1 MT = 1000 kg.

// kg (stored) -> MT display string, 2 decimals (e.g. 64554 -> "64.55").
export function kgToMtStr(kg, dp = 2) {
  const v = (Number(kg) || 0) / 1000
  return v.toFixed(dp)
}

// kg (stored) -> MT number.
export function kgToMt(kg) {
  return (Number(kg) || 0) / 1000
}

// MT (user input) -> kg number to store.
export function mtToKg(mt) {
  return (Number(mt) || 0) * 1000
}

// "2 MT (2,000 kg)" style dual label for purchases.
export function bothUnits(kg) {
  const k = Number(kg) || 0
  return `${kgToMtStr(k)} MT (${Math.round(k).toLocaleString('en-IN')} kg)`
}

// Short human code for an equipment/vehicle from the last 4 alphanumerics of its
// identifier (vehicle/generator number), e.g. "UP45AT9028" -> "9028". Helps tell
// apart machines that share a name. Returns '' when no identifier is given.
export function equipCode(identifier) {
  const s = (identifier || '').toString().replace(/[^A-Za-z0-9]/g, '')
  return s.length >= 4 ? s.slice(-4) : s
}
