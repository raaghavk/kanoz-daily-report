import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, jsonResponse, requireCaller, callerHasPermission } from '../_shared/callerAuth.ts'

/**
 * Set or reset an employee's auth password (and optionally email).
 * Body: { employee_id, password?, email?, new_email? }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    const allowed = await callerHasPermission(caller.admin, caller.employee, 'manage_users')
    if (!allowed) return jsonResponse({ error: 'You do not have permission to manage users' }, 403)

    const body = await req.json() as {
      employee_id?: string
      password?: string
      email?: string
      new_email?: string
    }
    const employee_id = body.employee_id
    const password = body.password
    const newEmail = (body.new_email || body.email || '').trim()

    if (!employee_id) return jsonResponse({ error: 'employee_id is required' }, 400)

    const { data: target, error: empErr } = await caller.admin
      .from('employees')
      .select('id, auth_user_id, email, name')
      .eq('id', employee_id)
      .eq('org_id', caller.employee.org_id)
      .maybeSingle()

    if (empErr || !target) return jsonResponse({ error: 'Employee not found' }, 404)

    if (password && password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
    }

    const adminAuth = caller.admin.auth.admin

    if (!target.auth_user_id) {
      const email = newEmail || target.email
      if (!email) return jsonResponse({ error: 'Email is required to create a login' }, 400)
      if (!password) return jsonResponse({ error: 'Password is required to create a login' }, 400)

      const { data: created, error: createErr } = await adminAuth.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: target.name },
      })
      if (createErr || !created.user) {
        return jsonResponse({ error: createErr?.message || 'Failed to create login' }, 400)
      }
      const { error: linkErr } = await caller.admin
        .from('employees')
        .update({ auth_user_id: created.user.id, email, updated_at: new Date().toISOString() })
        .eq('id', target.id)
      if (linkErr) return jsonResponse({ error: linkErr.message }, 500)
      return jsonResponse({ success: true, created: true })
    }

    const patch: { password?: string; email?: string } = {}
    if (password) patch.password = password
    if (newEmail) patch.email = newEmail
    if (!Object.keys(patch).length) return jsonResponse({ error: 'Nothing to update' }, 400)

    const { error: updErr } = await adminAuth.updateUserById(target.auth_user_id, patch)
    if (updErr) return jsonResponse({ error: updErr.message }, 400)

    if (newEmail) {
      await caller.admin.from('employees').update({ email: newEmail, updated_at: new Date().toISOString() }).eq('id', target.id)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('set-user-password error:', err)
    return jsonResponse({ error: (err as Error).message || 'Failed' }, 500)
  }
})
