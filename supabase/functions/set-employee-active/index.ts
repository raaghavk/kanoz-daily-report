import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, jsonResponse, requireCaller, callerHasPermission } from '../_shared/callerAuth.ts'
import { authBanAttributes, authBanStepOrder, cannotDeactivateSelf } from '../_shared/authBan.js'

/**
 * Set employees.is_active and ban/unban the linked Auth login.
 * Body: { employee_id, is_active: boolean }
 *
 * Must be called by an authenticated admin (manage_users).
 * Deactivate bans first (876000h), then flips the roster flag.
 * Reactivate flips the roster flag first, then unbans (ban_duration: 'none').
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    const allowed = await callerHasPermission(caller.admin, caller.employee, 'manage_users')
    if (!allowed) return jsonResponse({ error: 'You do not have permission to manage users' }, 403)

    const body = await req.json() as { employee_id?: string; is_active?: boolean }
    const employee_id = body.employee_id
    const is_active = body.is_active

    if (!employee_id) return jsonResponse({ error: 'employee_id is required' }, 400)
    if (typeof is_active !== 'boolean') return jsonResponse({ error: 'is_active must be a boolean' }, 400)

    const { data: target, error: empErr } = await caller.admin
      .from('employees')
      .select('id, auth_user_id, is_active, org_id')
      .eq('id', employee_id)
      .eq('org_id', caller.employee.org_id)
      .maybeSingle()

    if (empErr || !target) return jsonResponse({ error: 'Employee not found' }, 404)

    if (cannotDeactivateSelf(caller.user.id, target.auth_user_id, is_active)) {
      return jsonResponse({ error: 'You cannot deactivate your own account' }, 400)
    }

    const adminAuth = caller.admin.auth.admin
    const order = authBanStepOrder(is_active)

    for (const step of order) {
      if (step === 'ban' || step === 'unban') {
        if (!target.auth_user_id) continue
        const { error: banErr } = await adminAuth.updateUserById(
          target.auth_user_id,
          authBanAttributes(is_active),
        )
        if (banErr) {
          const verb = is_active ? 'unban' : 'ban'
          return jsonResponse({ error: `Failed to ${verb} login: ${banErr.message}` }, 500)
        }
      } else if (step === 'roster') {
        const { error: updErr } = await caller.admin
          .from('employees')
          .update({ is_active, updated_at: new Date().toISOString() })
          .eq('id', target.id)
        if (updErr) return jsonResponse({ error: updErr.message }, 500)
      }
    }

    return jsonResponse({ success: true, is_active, banned: !is_active && !!target.auth_user_id })
  } catch (err) {
    console.error('set-employee-active error:', err)
    return jsonResponse({ error: (err as Error).message || 'Failed' }, 500)
  }
})
