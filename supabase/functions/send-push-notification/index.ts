import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@kanoz.in'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Crypto helpers for Web Push (RFC 8291 + VAPID RFC 8292) ──

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const b of buffers) {
    result.set(b, offset)
    offset += b.length
  }
  return result
}

/** Create a VAPID Authorization header (JWT signed with ES256). */
async function createVapidAuth(audience: string): Promise<{ authorization: string; cryptoKey: string }> {
  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY)

  // Import ECDSA private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(33, 65)),
    d: base64UrlEncode(privateKeyBytes),
  }

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  // JWT header & payload
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  })))

  const unsignedToken = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  )

  // Convert DER signature to raw r||s format (each 32 bytes)
  const sigBytes = new Uint8Array(signature)
  let r: Uint8Array, s: Uint8Array

  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32)
    s = sigBytes.slice(32)
  } else {
    // DER format: 0x30 len 0x02 rlen r 0x02 slen s
    const rLen = sigBytes[3]
    const rStart = 4
    const rBytes = sigBytes.slice(rStart, rStart + rLen)
    const sLen = sigBytes[rStart + rLen + 1]
    const sStart = rStart + rLen + 2
    const sBytes = sigBytes.slice(sStart, sStart + sLen)

    r = new Uint8Array(32)
    s = new Uint8Array(32)
    r.set(rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes, 32 - Math.min(rBytes.length, 32))
    s.set(sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes, 32 - Math.min(sBytes.length, 32))
  }

  const jwt = `${unsignedToken}.${base64UrlEncode(concatBuffers(r, s))}`

  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
  }
}

/** Encrypt push payload per RFC 8291 (aes128gcm). */
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKey = base64UrlDecode(p256dhKey)
  const clientAuth = base64UrlDecode(authSecret)

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey))

  // Import client's public key
  const clientKey = await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, localKeyPair.privateKey, 256))

  // HKDF-based key derivation (RFC 8291)
  const encoder = new TextEncoder()

  // PRK = HKDF-Extract(salt=auth, IKM=sharedSecret)
  const prkKey = await crypto.subtle.importKey('raw', clientAuth, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, sharedSecret))

  // Info for IKM derivation
  const keyInfo = concatBuffers(
    encoder.encode('WebPush: info\0'),
    clientPublicKey,
    localPublicKeyRaw
  )

  // IKM = HKDF-Expand(PRK=prk, info=keyInfo, L=32)
  const ikmHmac = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', ikmHmac, concatBuffers(keyInfo, new Uint8Array([1]))))

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK for content encryption
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const contentPrk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm))

  // Content encryption key (CEK)
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0')
  const cekHmac = await crypto.subtle.importKey('raw', contentPrk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const cekFull = new Uint8Array(await crypto.subtle.sign('HMAC', cekHmac, concatBuffers(cekInfo, new Uint8Array([1]))))
  const cek = cekFull.slice(0, 16)

  // Nonce
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0')
  const nonceHmac = await crypto.subtle.importKey('raw', contentPrk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const nonceFull = new Uint8Array(await crypto.subtle.sign('HMAC', nonceHmac, concatBuffers(nonceInfo, new Uint8Array([1]))))
  const nonce = nonceFull.slice(0, 12)

  // Pad payload (add \x02 delimiter for last record)
  const paddedPayload = concatBuffers(encoder.encode(payload), new Uint8Array([2]))

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload))

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)

  const header = concatBuffers(
    salt,
    rs,
    new Uint8Array([localPublicKeyRaw.length]),
    localPublicKeyRaw
  )

  return {
    encrypted: concatBuffers(header, ciphertext),
    localPublicKey: localPublicKeyRaw,
  }
}

/** Send a single web push notification. */
async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string
): Promise<{ success: boolean; status: number }> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  const [vapidHeaders, { encrypted }] = await Promise.all([
    createVapidAuth(audience),
    encryptPayload(payload, p256dh, auth),
  ])

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': vapidHeaders.authorization,
      'Urgency': 'high',
    },
    body: encrypted,
  })

  return { success: response.ok || response.status === 201, status: response.status }
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { event_type, payload } = await req.json()

    // Build notification content
    let title = 'Kanoz Daily Report'
    let body = ''
    let url = '/'

    switch (event_type) {
      case 'report_submitted':
        title = `Shift ${payload.shift} Report Submitted`
        body = `${payload.supervisor} — ${payload.production_mt} MT produced at ${payload.plant}`
        url = '/reports'
        break
      case 'dispatch_created':
        title = `Dispatch: ${payload.truck_number}`
        body = `${payload.quantity_mt} MT to ${payload.customer} from ${payload.plant}`
        url = '/dispatch'
        break
      default:
        return new Response(JSON.stringify({ error: 'Unknown event type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Get all push subscriptions (send to all users, not just admins)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (error) throw error
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notificationPayload = JSON.stringify({ title, body, url, tag: event_type })

    let sent = 0
    const errors: string[] = []
    for (const sub of subscriptions) {
      try {
        const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, notificationPayload)
        if (result.success) {
          sent++
        } else if (result.status === 404 || result.status === 410) {
          // Subscription expired, clean up
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          errors.push(`Status ${result.status} for ${sub.endpoint.slice(0, 50)}...`)
        }
      } catch (pushErr) {
        errors.push((pushErr as Error).message)
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
