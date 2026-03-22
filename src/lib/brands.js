const BASE_BRANDS = ['ABB', 'Bosch', 'Crompton', 'FAG', 'Fenner', 'Havells', 'L&T', 'Rexnord', 'Schneider', 'Siemens', 'SKF', 'Texrope']
const STORAGE_KEY = 'kanoz_custom_brands'

export function getBrands() {
  try {
    const custom = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const all = [...BASE_BRANDS, ...custom.filter(b => !BASE_BRANDS.includes(b))]
    return [...all.sort(), 'Other']
  } catch {
    return [...BASE_BRANDS, 'Other']
  }
}

export function saveCustomBrand(brand) {
  if (!brand || BASE_BRANDS.includes(brand) || brand === 'Other') return
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!existing.includes(brand)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, brand]))
    }
  } catch { /* silent */ }
}
