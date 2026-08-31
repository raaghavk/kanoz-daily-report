import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type Caller = {
  user: User
  employee: { id: string; role: string; org_id: string; plant_id: string | null }
  admin: SupabaseClient
}

export async function requireCaller(req: Request): Promise<Caller | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await callerClient.auth.getUser()
  if (error || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: employee } = await admin
    .from('employees')
    .select('id, role, org_id, plant_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!employee?.org_id) return jsonResponse({ error: 'No employee profile' }, 403)
  return { user, employee, admin }
}

export async function requirePlantAccess(
  admin: SupabaseClient,
  employee: Caller['employee'],
  plantId: string | undefined | null,
): Promise<{ id: string; org_id: string; name: string | null } | Response> {
  if (!plantId) return jsonResponse({ error: 'plantId is required' }, 400)
  const { data: plant } = await admin.from('plants').select('id, org_id, name').eq('id', plantId).maybeSingle()
  if (!plant) return jsonResponse({ error: 'Plant not found' }, 404)
  if (plant.org_id !== employee.org_id) return jsonResponse({ error: 'Forbidden' }, 403)
  return plant
}

export async function callerHasPermission(
  admin: SupabaseClient,
  employee: Caller['employee'],
  permission: string,
): Promise<boolean> {
  if (employee.role === 'admin') return true
  const { data: byKey } = await admin
    .from('roles')
    .select('permissions')
    .eq('org_id', employee.org_id)
    .eq('key', employee.role)
    .maybeSingle()
  let perms: string[] = Array.isArray(byKey?.permissions) ? byKey.permissions : []
  if (!perms.length) {
    const { data: byName } = await admin
      .from('roles')
      .select('permissions')
      .eq('org_id', employee.org_id)
      .eq('name', employee.role)
      .maybeSingle()
    perms = Array.isArray(byName?.permissions) ? byName.permissions : []
  }
  return perms.includes(permission)
}
