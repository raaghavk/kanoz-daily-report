/** Allowlist for mode=rest. Embeds of other tables are forwarded as select=, not as the path table. */
export const REST_PROXY_TABLES = Object.freeze([
  'raw_material_purchases',
  'vehicle_dispatches',
  'shift_reports',
  'suppliers',
  'transporters',
])

export function isAllowedRestProxyTable(table) {
  return REST_PROXY_TABLES.includes(String(table || ''))
}

/** Strip mode= and table=; keep the Apps Script PostgREST query string as-is. */
export function restProxyForwardSearchFromRaw(search) {
  const raw = String(search || '').replace(/^\?/, '')
  if (!raw) return ''
  return raw
    .split('&')
    .filter((part) => {
      if (!part) return false
      let key = part.split('=')[0] || ''
      try {
        key = decodeURIComponent(key)
      } catch { /* keep raw key */ }
      return key.trim() !== 'mode' && key.trim() !== 'table'
    })
    .join('&')
}

export function restProxyUpstreamUrl(supabaseUrl, table, search) {
  if (!isAllowedRestProxyTable(table)) return null
  const base = String(supabaseUrl || '').replace(/\/$/, '')
  const qs = restProxyForwardSearchFromRaw(search)
  return `${base}/rest/v1/${table}${qs ? `?${qs}` : ''}`
}

export function restProxyForwardHeaders(getHeader) {
  const headers = {}
  const prefer = getHeader('prefer')
  const range = getHeader('range')
  if (prefer) headers.Prefer = prefer
  if (range) headers.Range = range
  return headers
}
