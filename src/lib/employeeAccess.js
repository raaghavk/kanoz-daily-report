/**
 * Team / auth helpers for employees.is_active vs employees.auth_user_id.
 *
 * These are two different flags:
 *   is_active     — roster Active/Inactive (admin toggle on Team)
 *   auth_user_id  — whether a Supabase Auth login is linked
 *
 * The Team card used to show "App access active" whenever auth_user_id was set,
 * even for people in the Inactive section. Deactivate now also bans Auth via
 * set-employee-active; leftover JWTs are still blocked by RLS.
 */

export function isEmployeeActive(emp) {
  return !!emp && emp.is_active !== false
}

/** Label + tone for the Team card access line. */
export function appAccessLabel(emp) {
  if (!emp) return { kind: 'none', text: 'No app access' }
  if (emp.is_active === false) {
    if (emp.auth_user_id) {
      return { kind: 'blocked', text: 'App access blocked' }
    }
    return { kind: 'none', text: 'No app access' }
  }
  if (emp.auth_user_id) {
    return { kind: 'active', text: 'App access active' }
  }
  return { kind: 'pending', text: 'No app access yet' }
}

/** Body for the set-employee-active edge function (ban/unban Auth). */
export function setEmployeeActiveBody(employeeId, isActive) {
  return { employee_id: employeeId, is_active: isActive === true }
}

export function activeStatusChanged(previous, next) {
  return Boolean(previous) !== Boolean(next)
}
