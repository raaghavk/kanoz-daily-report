import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BLdPehJlH7XhX3UUJyR54_0PLgnHAW2udJXZaJig5jmH4WNUZobXcQV5FyjQH5HHTNohflrlPSm8j8JR2FvGTCA'

/**
 * All supported notification event types with UI labels.
 * admin_only = true means only shown to admin role in Settings UI.
 */
export const EVENT_TYPES = [
  {
    key: 'report_submitted',
    label: 'Shift Report Submitted',
    description: 'When a new shift report is submitted',
  },
  {
    key: 'report_edited',
    label: 'Shift Report Edited',
    description: 'When a shift report is updated',
  },
  {
    key: 'purchase_added',
    label: 'RM Purchase Added',
    description: 'When a raw material purchase is recorded',
  },
  {
    key: 'dispatch_created',
    label: 'Dispatch Created',
    description: 'When a new vehicle dispatch is created',
  },
  {
    key: 'issue_reported',
    label: 'Issue / Breakdown Reported',
    description: 'When an issue is logged in a shift report',
  },
  {
    key: 'spare_part_reorder',
    label: 'Spare Part Reorder Request',
    description: 'When a reorder request is raised for a spare part',
  },
  {
    key: 'spare_part_low_stock',
    label: 'Spare Part Below Minimum',
    description: 'When a spare part falls below minimum stock level',
  },
  {
    key: 'task_assigned',
    label: 'Task Assigned to You',
    description: 'When someone assigns a task to you',
  },
  {
    key: 'task_updated',
    label: 'Task Status Updated',
    description: 'When a task assigned to you is updated',
  },
  {
    key: 'delete_request_raised',
    label: 'Deletion Request Raised',
    description: 'When someone submits a deletion request',
    admin_only: true,
  },
]

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
 * Fetch notification preferences for an employee.
 * Returns array of { event_type, enabled } objects.
 */
export async function getNotificationPreferences(employeeId) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('event_type, enabled')
    .eq('employee_id', employeeId)
  if (error) throw error
  return data || []
}

/**
 * Enable or disable a specific notification type for an employee.
 */
export async function setNotificationPreference(employeeId, eventType, enabled) {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { employee_id: employeeId, event_type: eventType, enabled },
      { onConflict: 'employee_id,event_type' }
    )
  if (error) throw error
}

/**
 * Send a push notification via Supabase Edge Function.
 * The edge function handles filtering by notification_preferences.
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
