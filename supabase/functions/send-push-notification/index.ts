import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@kanoz.in'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Send web push notifications to admins when reports are submitted or dispatches created.
 *
 * Expected body:
 * {
 *   event_type: 'report_submitted' | 'dispatch_created',
 *   payload: { shift, supervisor, production_mt, plant, date, ... }
 * }
 */
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

    // Get admin push subscriptions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, employee_id, employees(role)')
      .eq('employees.role', 'admin')

    if (error) throw error
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No admin subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send push to each subscription using Web Push protocol
    const notificationPayload = JSON.stringify({ title, body, url, tag: event_type })

    let sent = 0
    for (const sub of subscriptions) {
      try {
        // Use the web-push compatible API
        const pushEndpoint = sub.endpoint
        const response = await fetch(pushEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
          },
          body: notificationPayload,
        })

        if (response.ok || response.status === 201) {
          sent++
        } else if (response.status === 410) {
          // Subscription expired, clean up
          await supabase.from('push_subscriptions').delete().eq('endpoint', pushEndpoint)
        }
      } catch (pushErr) {
        console.error('Push send error:', pushErr)
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
