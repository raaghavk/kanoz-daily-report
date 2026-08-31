import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Permanently (hard) delete an employee and their Supabase auth login.
 *
 * Expected body:
 * {
 *   employee_id: UUID
 * }
 *
 * Must be called by an authenticated admin user.
 * Flow:
 *  1. Verify caller is an authenticated admin (via their JWT).
 *  2. Look up the target employee; refuse if caller is deleting themselves.
 *  3. If the employee has a linked auth user, delete it (ignore "not found").
 *  4. Delete the employee row.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check caller is an admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: callerEmployee } = await adminClient
      .from('employees')
      .select('role, org_id')
      .eq('auth_user_id', callerUser.id)
      .single()

    let callerAllowed = callerEmployee?.role === 'admin'
    if (callerEmployee && !callerAllowed) {
      const { data: roleRow } = await adminClient
        .from('roles').select('permissions').eq('org_id', callerEmployee.org_id)
        .or(`key.eq.${callerEmployee.role},name.eq.${callerEmployee.role}`).maybeSingle()
      const perms = Array.isArray(roleRow?.permissions) ? roleRow.permissions : []
      callerAllowed = perms.includes('manage_users')
    }

    if (!callerEmployee || !callerAllowed) {
      return new Response(JSON.stringify({ error: 'You do not have permission to delete users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { employee_id } = await req.json()

    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'employee_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up the target employee
    const { data: targetEmployee, error: empError } = await adminClient
      .from('employees')
      .select('id, auth_user_id')
      .eq('id', employee_id)
      .eq('org_id', callerEmployee.org_id)
      .single()

    if (empError || !targetEmployee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Guard: refuse to delete yourself
    if (targetEmployee.auth_user_id && targetEmployee.auth_user_id === callerUser.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete the linked auth user (ignore "user not found")
    if (targetEmployee.auth_user_id) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetEmployee.auth_user_id)
      if (deleteAuthError && !/not found/i.test(deleteAuthError.message || '')) {
        return new Response(JSON.stringify({ error: 'Failed to delete login: ' + deleteAuthError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Try to hard-delete the employee row. If it's blocked by references (they created
    // shift reports / purchases / dispatches, etc.), fall back to DEACTIVATING them —
    // their login is already revoked above, and their history/attribution is preserved.
    const { error: deleteEmpError } = await adminClient
      .from('employees')
      .delete()
      .eq('id', employee_id)

    if (deleteEmpError) {
      const { error: deactivateError } = await adminClient
        .from('employees')
        .update({ is_active: false, auth_user_id: null, updated_at: new Date().toISOString() })
        .eq('id', employee_id)
      if (deactivateError) {
        return new Response(JSON.stringify({ error: 'Could not remove user: ' + deactivateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, deactivated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
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
