/**
 * Google Sheets helpers for edge functions (service-account JWT).
 * Secret: GOOGLE_SERVICE_ACCOUNT_JSON
 */

export async function getGoogleAccessToken(serviceAccount: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  function base64url(data: string) {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerB64 = base64url(JSON.stringify(header))
  const claimB64 = base64url(JSON.stringify(claim))
  const signInput = `${headerB64}.${claimB64}`

  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signInput),
  )
  const sigB64 = base64url(String.fromCharCode(...new Uint8Array(signature)))
  const jwt = `${signInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token as string
}

export function loadServiceAccount(): { client_email: string; private_key: string } {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!raw) throw new Error('Google service account not configured (GOOGLE_SERVICE_ACCOUNT_JSON)')
  return JSON.parse(raw)
}

/** Ensure a sheet/tab exists; return its title. */
export async function ensureSheetTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!metaRes.ok) {
    throw new Error(`Sheets meta error: ${metaRes.status} ${await metaRes.text()}`)
  }
  const meta = await metaRes.json()
  const titles = (meta.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title)
  if (titles.includes(tabName)) return tabName

  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: tabName } } }],
      }),
    },
  )
  if (!addRes.ok) {
    throw new Error(`Sheets addSheet error: ${addRes.status} ${await addRes.text()}`)
  }
  return tabName
}

export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 400) return [] // empty / missing range
  if (!res.ok) throw new Error(`Sheets get values error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return (data.values || []) as string[][]
}

export async function clearSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!res.ok) throw new Error(`Sheets clear error: ${res.status} ${await res.text()}`)
}

export async function updateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
): Promise<{ updatedRange?: string }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`Sheets update error: ${res.status} ${await res.text()}`)
  return await res.json()
}

export async function appendSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
): Promise<{ updates?: { updatedRange?: string } }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`Sheets append error: ${res.status} ${await res.text()}`)
  return await res.json()
}
