import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Create a Supabase auth user and link it to an existing employee record.
 *
 * Expected body:
 * {
 *   email: string,
 *   password: string,
 *   employee_id: UUID
 * }
 *
 * Must be called by an authenticated admin user.
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

    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can invite users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, employee_id } = await req.json()

    if (!email || !password || !employee_id) {
      return new Response(JSON.stringify({ error: 'email, password, and employee_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify employee exists, belongs to same org, and has no auth user yet
    const { data: targetEmployee, error: empError } = await adminClient
      .from('employees')
      .select('id, auth_user_id, org_id')
      .eq('id', employee_id)
      .single()

    if (empError || !targetEmployee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (targetEmployee.org_id !== callerEmployee.org_id) {
      return new Response(JSON.stringify({ error: 'Employee belongs to a different organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (targetEmployee.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Employee already has login credentials' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the auth user using admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Link the auth user to the employee record
    const { error: updateError } = await adminClient
      .from('employees')
      .update({ auth_user_id: newUser.user.id, updated_at: new Date().toISOString() })
      .eq('id', employee_id)

    if (updateError) {
      // Rollback: delete the auth user if linking fails
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: 'Failed to link user to employee: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
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
