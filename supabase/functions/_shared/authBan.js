/**
 * Auth ban helpers for employee deactivate / reactivate.
 *
 * Supabase has no "permanent" ban: 876000h is 100 years (docs example).
 * ban_duration: 'none' lifts the ban.
 * These helpers are Deno-import-free so vitest can cover them.
 */

export const PERMANENT_BAN_DURATION = '876000h'
export const UNBAN_DURATION = 'none'

export function authBanAttributes(isActive) {
  return { ban_duration: isActive ? UNBAN_DURATION : PERMANENT_BAN_DURATION }
}

/** Ban before flipping the roster off; unban after flipping it on. */
export function authBanStepOrder(isActive) {
  return isActive ? ['roster', 'unban'] : ['ban', 'roster']
}

export function inactiveCallerResponse(employee) {
  if (!employee) return { error: 'No employee profile', status: 403 }
  if (employee.is_active === false) return { error: 'Account deactivated', status: 403 }
  return null
}

export function cannotDeactivateSelf(callerAuthId, targetAuthUserId, isActive) {
  return isActive === false && !!targetAuthUserId && targetAuthUserId === callerAuthId
}
