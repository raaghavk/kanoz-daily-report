/**
 * Deep-link paths for purchase/dispatch push notifications.
 * Matches send-push-notification (purchase_added / dispatch_created).
 */
export function purchasePushPath(purchaseId) {
  return purchaseId ? `/purchase/${purchaseId}` : '/purchase'
}

export function dispatchPushPath(dispatchId) {
  return dispatchId ? `/dispatch/${dispatchId}` : '/dispatch'
}
