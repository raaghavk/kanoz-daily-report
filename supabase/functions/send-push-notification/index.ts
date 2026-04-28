import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// VAPID keys are loaded from app_config table (cached after first load)
let VAPID_PUBLIC_KEY = ''
let VAPID_PRIVATE_KEY = ''
let VAPID_SUBJECT = 'mailto:admin@kanoz.in'
let configLoaded = false

async function loadVapidConfig(supabase: any) {
  if (configLoaded) return
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])
  if (error) throw new Error(`Failed to load VAPID config: ${error.message}`)
  if (!data || data.length === 0) throw new Error('VAPID keys not found in app_config table')
  for (const row of data) {
    if (row.key === 'VAPID_PUBLIC_KEY') VAPID_PUBLIC_KEY = row.value
    else if (row.key === 'VAPID_PRIVATE_KEY') VAPID_PRIVATE_KEY = row.value
    else if (row.key === 'VAPID_SUBJECT') VAPID_SUBJECT = row.value
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY missing in app_config')
  }
  configLoaded = true
}

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

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(VAPID_PUBLIC_KEY).slice(33, 65)),
    d: base64UrlEncode(privateKeyBytes),
  }

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

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

  const sigBytes = new Uint8Array(signature)
  let r: Uint8Array, s: Uint8Array

  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32)
    s = sigBytes.slice(32)
  } else {
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

  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey))

  const clientKey = await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, localKeyPair.privateKey, 256))

  const encoder = new TextEncoder()

  const prkKey = await crypto.subtle.importKey('raw', clientAuth, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, sharedSecret))

  const keyInfo = concatBuffers(
    encoder.encode('WebPush: info\0'),
    clientPublicKey,
    localPublicKeyRaw
  )

  const ikmHmac = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', ikmHmac, concatBuffers(keyInfo, new Uint8Array([1]))))

  const salt = crypto.getRandomValues(new Uint8Array(16))

  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const contentPrk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm))

  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0')
  const cekHmac = await crypto.subtle.importKey('raw', contentPrk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const cekFull = new Uint8Array(await crypto.subtle.sign('HMAC', cekHmac, concatBuffers(cekInfo, new Uint8Array([1]))))
  const cek = cekFull.slice(0, 16)

  const nonceInfo = encoder.encode('Content-Encoding: nonce\0')
  const nonceHmac = await crypto.subtle.importKey('raw', contentPrk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const nonceFull = new Uint8Array(await crypto.subtle.sign('HMAC', nonceHmac, concatBuffers(nonceInfo, new Uint8Array([1]))))
  const nonce = nonceFull.slice(0, 12)

  const paddedPayload = concatBuffers(encoder.encode(payload), new Uint8Array([2]))

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload))

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

// ── Task-targeted events: only notify the specific assignee ──
const TASK_EVENTS = new Set(['task_assigned', 'task_updated'])

// ── Main handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { event_type, payload } = await req.json()

    // Build notification content per event type
    let title = 'Kanoz Daily Report'
    let body = ''
    let url = '/'

    switch (event_type) {
      case 'report_submitted':
        title = `Shift ${payload.shift} Report Submitted`
        body = `${payload.supervisor} — ${payload.production_mt} MT produced at ${payload.plant}`
        url = '/reports'
        break
      case 'report_edited':
        title = `Shift ${payload.shift} Report Updated`
        body = `${payload.supervisor} edited the report at ${payload.plant}`
        url = payload.report_id ? `/reports/${payload.report_id}` : '/reports'
        break
      case 'purchase_added':
        title = `RM Purchase: ${payload.material}`
        body = `${payload.quantity_kg} kg from ${payload.supplier} at ${payload.plant}`
        url = '/purchase'
        break
      case 'dispatch_created':
        title = `Dispatch: ${payload.truck_number}`
        body = `${payload.quantity_mt} MT to ${payload.customer} from ${payload.plant}`
        url = '/dispatch'
        break
      case 'issue_reported': {
        const sevLabel = payload.severity === 'critical' ? '🚨 Critical' : payload.severity === 'high' ? '⚠ High' : '📋'
        title = `${sevLabel} Issue: ${payload.type}`
        body = `${payload.description}${payload.count > 1 ? ` (+${payload.count - 1} more)` : ''} at ${payload.plant}`
        url = payload.report_id ? `/reports/${payload.report_id}` : '/reports'
        break
      }
      case 'spare_part_reorder':
        title = `Reorder Request: ${payload.part_name}`
        body = `Raised by ${payload.requested_by} at ${payload.plant}`
        url = '/spare-parts/reorder'
        break
      case 'spare_part_low_stock':
        title = `⚠ Low Stock: ${payload.part_name}`
        body = `${payload.current_stock} ${payload.unit} left (min: ${payload.min_stock_level}) at ${payload.plant}`
        url = '/spare-parts/parts'
        break
      case 'task_assigned':
        title = `New Task Assigned`
        body = `${payload.task_title}${payload.due_date ? ` · Due ${payload.due_date}` : ''} — from ${payload.assigned_by}`
        url = '/tasks'
        break
      case 'task_updated':
        title = `Task ${payload.new_status === 'done' ? 'Marked Done' : payload.new_status === 'closed' ? 'Closed' : 'Updated'}`
        body = payload.task_title
        url = '/tasks'
        break
      case 'delete_request_raised':
        title = `Deletion Request`
        body = `${payload.requested_by} wants to delete: ${payload.entity_label} at ${payload.plant}`
        url = '/delete-requests'
        break
      default:
        return new Response(JSON.stringify({ error: 'Unknown event type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    await loadVapidConfig(supabase)

    let subsToNotify: Array<{ endpoint: string; p256dh: string; auth: string }> = []

    const NOTIF_ROLES = ['admin', 'plant_manager', 'supervisor']

    if (TASK_EVENTS.has(event_type)) {
      // Task events: only notify the specific assignee if they have an eligible role
      const assigneeId = payload.assignee_employee_id
      if (!assigneeId) {
        return new Response(JSON.stringify({ sent: 0, message: 'No assignee specified' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check assignee role
      const { data: emp } = await supabase
        .from('employees')
        .select('role')
        .eq('id', assigneeId)
        .maybeSingle()
      if (!emp || !NOTIF_ROLES.includes(emp.role)) {
        return new Response(JSON.stringify({ sent: 0, message: 'Assignee role not eligible for notifications' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check if assignee has this event type enabled
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('enabled')
        .eq('employee_id', assigneeId)
        .eq('event_type', event_type)
        .maybeSingle()

      if (!prefs || !prefs.enabled) {
        return new Response(JSON.stringify({ sent: 0, message: 'Assignee has not enabled this notification' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('employee_id', assigneeId)

      subsToNotify = subs || []
    } else {
      // Broadcast events: send to all employees who have enabled this event type + have eligible roles
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('employee_id')
        .eq('event_type', event_type)
        .eq('enabled', true)

      if (!prefs || prefs.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No subscribers for this event type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const enabledIds = prefs.map((p: any) => p.employee_id)

      // Filter to only employees with eligible roles
      const { data: eligibleEmps } = await supabase
        .from('employees')
        .select('id')
        .in('id', enabledIds)
        .in('role', NOTIF_ROLES)

      const eligibleIds = (eligibleEmps || []).map((e: any) => e.id)
      if (eligibleIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No eligible subscribers' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('employee_id', eligibleIds)

      subsToNotify = subs || []
    }

    if (subsToNotify.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No push subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notificationPayload = JSON.stringify({ title, body, url, tag: event_type })

    let sent = 0
    const errors: string[] = []
    for (const sub of subsToNotify) {
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

    return new Response(JSON.stringify({ sent, total: subsToNotify.length, errors: errors.length > 0 ? errors : undefined }), {
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
