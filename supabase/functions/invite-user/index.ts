import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Create a Supabase auth user and send them a password-setup email.
 *
 * Expected body:
 * {
 *   email: string,
 *   employee_id: UUID
 * }
 *
 * Must be called by an authenticated admin user.
 * Flow:
 *  1. Create auth user with a random temp password (email_confirm: true)
 *  2. Link auth user to employee record
 *  3. Generate a password-recovery link and send it via Supabase Auth email
 *     → employee receives "Set your password" email and sets their own password
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
      .select('role')
      .eq('auth_user_id', callerUser.id)
      .single()

    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can invite users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, employee_id } = await req.json()

    if (!email || !employee_id) {
      return new Response(JSON.stringify({ error: 'email and employee_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify employee exists and has no auth user yet
    const { data: targetEmployee, error: empError } = await adminClient
      .from('employees')
      .select('id, auth_user_id')
      .eq('id', employee_id)
      .single()

    if (empError || !targetEmployee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (targetEmployee.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Employee already has login credentials' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate a secure random temp password — employee will replace it via reset link
    const tempPassword = crypto.randomUUID() + crypto.randomUUID()

    // Create the auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // skip email confirmation, we send reset link instead
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

    // Send password recovery email so the employee sets their own password
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    // Even if the reset email fails, the account is created — return partial success
    if (resetError) {
      console.error('Reset email failed:', resetError.message)
      return new Response(JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email_sent: false,
        email_error: resetError.message,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.user.id,
      email_sent: true,
    }), {
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
