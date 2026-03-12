import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Convert a base64 URL string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Check if push notifications are supported and the current permission state.
 */
export function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported'
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'not_configured'
  return Notification.permission // 'default', 'granted', 'denied'
}

/**
 * Request notification permission and subscribe to push.
 * Stores the subscription in Supabase push_subscriptions table.
 */
export async function subscribeToPush(employeeId) {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID public key not configured. Set VITE_VAPID_PUBLIC_KEY env var.')
    return { success: false, reason: 'not_configured' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { success: false, reason: 'denied' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJSON = subscription.toJSON()

    // Upsert subscription in Supabase
    const { error } = await supabase.from('push_subscriptions').upsert({
      employee_id: employeeId,
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys.p256dh,
      auth: subJSON.keys.auth,
    }, { onConflict: 'employee_id' })

    if (error) throw error

    return { success: true }
  } catch (err) {
    console.error('Push subscription error:', err)
    return { success: false, reason: err.message }
  }
}

/**
 * Unsubscribe from push notifications and remove from Supabase.
 */
export async function unsubscribeFromPush(employeeId) {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }
    await supabase.from('push_subscriptions').delete().eq('employee_id', employeeId)
    return { success: true }
  } catch (err) {
    console.error('Push unsubscribe error:', err)
    return { success: false, reason: err.message }
  }
}

/**
 * Check if the current user has an active push subscription.
 */
export async function isSubscribed() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

/**
 * Send a push notification to admins via Supabase Edge Function.
 * Called after report submission or dispatch creation.
 */
export async function sendNotification(eventType, payload) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: { event_type: eventType, payload },
    })
  } catch (err) {
    // Non-critical — don't block the main flow
    console.error('Failed to send push notification:', err)
  }
}
